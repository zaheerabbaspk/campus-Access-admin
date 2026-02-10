import { Component, OnInit, ElementRef, ViewChild, inject, signal, OnDestroy } from '@angular/core';
import jsQR from 'jsqr'; // Import Library
import { CommonModule } from '@angular/common';
import { FaceRecognitionService } from '../../core/services/face-recognition.service';
import { StudentService } from '../../core/services/student.service';
import { LogService } from '../../core/services/log.service';
import { WeaponDetectionService } from '../../core/services/weapon-detection.service';
import { AuditLogService } from '../../core/services/audit-log.service';

@Component({
    selector: 'app-terminal',
    templateUrl: './terminal.page.html',
    styleUrls: ['./terminal.page.scss'],
    standalone: true,
    imports: [CommonModule]
})
export class TerminalPage implements OnInit, OnDestroy {
    @ViewChild('video') videoElement!: ElementRef<HTMLVideoElement>;
    @ViewChild('canvas') canvasElement!: ElementRef<HTMLCanvasElement>; // New Canvas Ref

    faceService = inject(FaceRecognitionService);
    studentService = inject(StudentService);
    logService = inject(LogService);
    weaponService = inject(WeaponDetectionService);
    auditLogService = inject(AuditLogService);

    isScanning = signal(false);
    lastRecognizedName = signal('');
    unknownUser = signal(false);
    weaponAlert = signal(false);
    scanStatus = signal('Initializing...');

    private stream: MediaStream | null = null;
    private scanInterval: any;

    async ngOnInit() {
        // 1. Start Camera Immediately (Priority for UX)
        this.startCamera();

        // 2. Load AI Models in Background
        try {
            this.scanStatus.set('Initializing Weapon Detection System...');
            await this.weaponService.loadModel();

            this.scanStatus.set('Initializing Face Recognition System...');
            await this.faceService.loadModels();

            this.scanStatus.set('System Ready. Monitoring active.');
        } catch (error: any) {
            console.error('Critical AI System Failure:', error);
            this.scanStatus.set(`System Error: ${error.message || 'Failed to load AI models'}`);
        }
    }

    ngOnDestroy() {
        this.stopCamera();
    }

    async startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' }
            });
            this.videoElement.nativeElement.srcObject = this.stream;
            this.scanStatus.set('System Ready. Stand in front of camera.');
            this.startScanning();
        } catch (err) {
            console.error('Error accessing camera:', err);
            this.scanStatus.set('Camera Error: Check permissions or connection.');
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        if (this.scanInterval) clearInterval(this.scanInterval);
    }

    startScanning() {
        this.scanInterval = setInterval(async () => {
            // Guard clause with auto-reset if stuck for too long (Watchdog)
            if (this.isScanning()) {
                console.warn('Skipping scan: Previous scan still in progress.');
                return;
            }
            if (this.weaponAlert() || this.lastRecognizedName() !== '' || this.unknownUser()) return;

            this.isScanning.set(true);
            const startTime = Date.now();

            try {
                // 0. QR Code Scanning (Fastest)
                const video = this.videoElement.nativeElement;
                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const code = jsQR(imageData.data, imageData.width, imageData.height, {
                            inversionAttempts: "dontInvert",
                        });

                        if (code && code.data) {
                            console.log('QR Code Detected:', code.data);
                            // Verify if it's a student ID
                            const student = this.studentService.students().find(s => s.id === code.data);
                            if (student) {
                                this.onStudentRecognized(student.id);
                                this.isScanning.set(false);
                                return; // Stop other checks if QR matches
                            } else {
                                // QR found but no matching student (Invalid/Unknown)
                                console.warn('Unknown QR Code:', code.data);
                                this.onUnknownUser();
                                this.isScanning.set(false);
                                return;
                            }
                        }
                    }
                }

                // TIMEOUT RACE: If detection takes > 3s, abort this cycle
                const scanPromise = (async () => {
                    // 1. Weapon Detection
                    try {
                        const threats = await this.weaponService.detectThreats(this.videoElement.nativeElement);
                        if (threats.length > 0) {
                            this.drawBoundingBoxes(threats); // Draw what AI sees

                            const actualThreat = threats.find(t => t.score > 0.3); // Alert threshold

                            if (actualThreat) {
                                // WEAPON FOUND: Now try to identify WHO has it
                                let studentName = 'Unknown Person';
                                try {
                                    const descriptor = await this.faceService.getFaceDescriptor(this.videoElement.nativeElement);
                                    if (descriptor) {
                                        const studentId = await this.faceService.findBestMatch(descriptor, this.studentService.students());
                                        const student = this.studentService.students().find(s => s.id === studentId);
                                        if (student) studentName = student.name;
                                    }
                                } catch (err) {
                                    console.log('Could not identify person during alert');
                                }

                                this.triggerEmergency(actualThreat, studentName);
                                return true;
                            }
                        } else {
                            // Clear canvas if no threats
                            const canvas = this.canvasElement.nativeElement;
                            const ctx = canvas.getContext('2d');
                            ctx?.clearRect(0, 0, canvas.width, canvas.height);
                        }
                    } catch (wErr) {
                        console.error('Weapon Scan Failed:', wErr);
                    }

                    // 2. Face Recognition
                    try {
                        const descriptor = await this.faceService.getFaceDescriptor(this.videoElement.nativeElement);
                        if (descriptor) {
                            const studentId = await this.faceService.findBestMatch(descriptor, this.studentService.students());
                            if (studentId) {
                                this.onStudentRecognized(studentId);
                            } else {
                                this.onUnknownUser();
                            }
                        }
                    } catch (fErr) {
                        console.error('Face Scan Failed:', fErr);
                    }
                    return false;
                })();

                // Timeout Monitor
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Scan Timeout')), 3000)
                );

                await Promise.race([scanPromise, timeoutPromise]); 

            } catch (err) {
                console.error('Scan Cycle Error/Timeout:', err);
            } finally {
                const duration = Date.now() - startTime;
                if (duration > 500) console.warn(`Slow scan detected: ${duration}ms`);
                this.isScanning.set(false);
            }
        }, 1000); // Check every 1 second
    }

    onStudentRecognized(id: string) {
        const student = this.studentService.students().find(s => s.id === id);
        if (student) {
            this.lastRecognizedName.set(student.name);

            // Mark attendance in Firebase
            this.logService.addLog({
                id: '', // Will be generated by Firebase
                studentId: student.id,
                studentName: student.name,
                departmentId: student.departmentId,
                sectionId: student.sectionId,
                timestamp: new Date(),
                status: 'Granted'
            });

            // UI Feedback - Clear message after a delay
            setTimeout(() => {
                this.lastRecognizedName.set('');
            }, 5000);
        }
    }

    onUnknownUser() {
        this.unknownUser.set(true);
        this.scanStatus.set('Access Denied: User not recognized.');

        setTimeout(() => {
            this.unknownUser.set(false);
            this.scanStatus.set('System Ready. Stand in front of camera.');
        }, 3000);
    }

    triggerEmergency(threat: any, studentName: string = 'Unknown Person') {
        this.weaponAlert.set(true);
        this.scanStatus.set(`EMERGENCY: ${threat.class.toUpperCase()} DETECTED! (${studentName})`);

        // Log to Audit Logs
        this.auditLogService.addLog({
            id: '',
            action: 'Security Alert',
            details: `Weapon detected at terminal: ${threat.class.toUpperCase()} by ${studentName} (${Math.round(threat.score * 100)}%)`,
            timestamp: new Date(),
            user: 'System-AI'
        });

        // Simple alert sound (browser beep)
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
        oscillator.connect(audioCtx.destination);
        oscillator.start();
        setTimeout(() => oscillator.stop(), 2000);

        // Reset after 10 seconds
        setTimeout(() => {
            this.weaponAlert.set(false);
            this.scanStatus.set('System Ready. Stand in front of camera.');
        }, 10000);
    }

    drawBoundingBoxes(predictions: any[]) {
        const video = this.videoElement.nativeElement;
        const canvas = this.canvasElement.nativeElement;
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        // Match canvas size to video size
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Clear previous drawings
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        predictions.forEach(prediction => {
            const [x, y, width, height] = prediction.bbox;

            // Draw Box
            ctx.strokeStyle = '#ef4444'; // Red color
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, width, height);

            // Draw Label Background
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(x, y - 30, width, 30);

            // Draw Text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px Inter';
            ctx.fillText(
                `${prediction.class.toUpperCase()} ${Math.round(prediction.score * 100)}%`,
                x + 5,
                y - 8
            );
        });
    }
}
