import { Component, OnInit, ElementRef, ViewChild, inject, signal, OnDestroy } from '@angular/core';
import jsQR from 'jsqr'; // Import Library
import { CommonModule } from '@angular/common';
import { FaceRecognitionService } from 'src/app/core/services/face-recognition.service';
import { StudentService } from 'src/app/core/services/student.service';
import { LogService } from 'src/app/core/services/log.service';
import { WeaponDetectionService } from 'src/app/core/services/weapon-detection.service';
import { AuditLogService } from 'src/app/core/services/audit-log.service';

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
                const video = this.videoElement.nativeElement;
                const canvas = this.canvasElement.nativeElement;
                const ctx = canvas.getContext('2d');

                // 0. Prepare Canvas & Sync Dimensions
                if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    // Note: We don't clear yet here, as QR check might need to draw.
                    // But we clear at the start of scanPromise if we reach it.
                } else {
                    this.isScanning.set(false);
                    return; // Wait for video to be fully ready with dimensions
                }

                // 1. QR Code Scanning (Highest Priority)
                if (ctx) {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = video.videoWidth;
                    tempCanvas.height = video.videoHeight;
                    const tempCtx = tempCanvas.getContext('2d');

                    if (tempCtx) {
                        tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
                        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                        const code = jsQR(imageData.data, imageData.width, imageData.height, {
                            inversionAttempts: "attemptBoth", // Better for phone screens
                        });

                        if (code && code.data) {
                            const rawData = code.data.trim();
                            let studentId = rawData;

                            // 1a. Attempt to parse JSON (User App format)
                            try {
                                const jsonData = JSON.parse(rawData);
                                if (jsonData.studentId || jsonData.rollNo) {
                                    studentId = jsonData.studentId || jsonData.rollNo;
                                    console.log('📦 JSON QR Data Extracted:', studentId);
                                }
                            } catch (e) {
                                // Not JSON, treat as raw ID string
                            }

                            console.log('📱 QR Detected:', studentId);

                            const student = this.studentService.students().find(s =>
                                s.id === studentId || s.firebaseId === studentId
                            );

                            if (student) {
                                // Draw QR Bounding Box (Green)
                                ctx.strokeStyle = '#22c55e';
                                ctx.lineWidth = 4;
                                ctx.beginPath();
                                ctx.moveTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
                                ctx.lineTo(code.location.topRightCorner.x, code.location.topRightCorner.y);
                                ctx.lineTo(code.location.bottomRightCorner.x, code.location.bottomRightCorner.y);
                                ctx.lineTo(code.location.bottomLeftCorner.x, code.location.bottomLeftCorner.y);
                                ctx.closePath();
                                ctx.stroke();

                                this.onStudentRecognized(student.id);
                                this.isScanning.set(false);
                                return;
                            } else {
                                console.warn('⚠️ Unknown QR ID:', studentId);
                                this.scanStatus.set(`Unknown identity: "${studentId}"`);
                                this.onUnknownUser();
                                this.isScanning.set(false);
                                return;
                            }
                        }
                    }
                }

                // 2. Clear canvas before weapon/face scans if QR didn't return
                ctx?.clearRect(0, 0, canvas.width, canvas.height);

                // Combined Scan Cycle
                const scanPromise = (async () => {
                    const video = this.videoElement.nativeElement;
                    const canvas = this.canvasElement.nativeElement;
                    const ctx = canvas.getContext('2d');

                    let emergencyTriggered = false;

                    // 1. Weapon Detection
                    try {
                        console.log('🔍 Starting weapon detection scan...');
                        const threats = await this.weaponService.detectThreats(video);

                        if (threats.length > 0) {
                            const actualThreat = threats.find(t => t.score > 0.25); // Increased threshold for production
                            if (actualThreat) {
                                // Draw only the actual threat boxes
                                this.drawBoundingBoxes(threats);

                                console.warn('🚨 WEAPON DETECTED:', actualThreat.class);

                                // Identify person during alert
                                let personName = 'Unknown Person';
                                const faceRes = await this.faceService.getFaceDetection(video);
                                if (faceRes) {
                                    const matchId = await this.faceService.findBestMatch(Array.from(faceRes.descriptor), this.studentService.students());
                                    const student = this.studentService.students().find(s => s.id === matchId);
                                    if (student) personName = student.name;
                                    this.drawFaceBox(faceRes); // Draw face during alert too
                                }

                                this.triggerEmergency(actualThreat, personName);
                                emergencyTriggered = true;
                            }
                        }
                    } catch (wErr) {
                        console.error('❌ Weapon Scan Failed:', wErr);
                    }

                    if (emergencyTriggered) return true;

                    // 2. Face Recognition (Normal Mode)
                    try {
                        console.log('🔍 Starting face detection scan...');
                        const faceResult = await this.faceService.getFaceDetection(video);

                        if (faceResult) {
                            this.drawFaceBox(faceResult);

                            const studentId = await this.faceService.findBestMatch(Array.from(faceResult.descriptor), this.studentService.students());

                            if (studentId) {
                                this.onStudentRecognized(studentId);
                            } else {
                                this.onUnknownUser();
                            }
                        }
                    } catch (fErr) {
                        console.error('❌ Face Scan Failed:', fErr);
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

            // Success Audio Feedback (Gentle blip)
            try {
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();

                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High A
                gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);

                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.2);
            } catch (e) {
                console.warn('Audio feedback failed:', e);
            }

            // Mark attendance in Firebase
            this.logService.addLog({
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
            action: 'Security Alert',
            entity: 'System',
            details: `Weapon detected at terminal: ${threat.class.toUpperCase()} by ${studentName} (${Math.round(threat.score * 100)}%)`
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

    drawFaceBox(faceResult: any) {
        const video = this.videoElement.nativeElement;
        const canvas = this.canvasElement.nativeElement;
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        const { x, y, width, height } = faceResult.detection.box;

        // Draw Box
        ctx.strokeStyle = '#3b82f6'; // Blue color for face
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);

        // Draw Label Background
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(x, y - 25, 120, 25);

        // Draw Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Inter';
        ctx.fillText(
            `👤 FACE ${Math.round(faceResult.detection.score * 100)}%`,
            x + 5,
            y - 7
        );
    }

    drawBoundingBoxes(threats: any[]) {
        const video = this.videoElement.nativeElement;
        const canvas = this.canvasElement.nativeElement;
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        threats.forEach(prediction => {
            const [x, y, width, height] = prediction.bbox;

            // Draw Box
            ctx.strokeStyle = '#ef4444'; // Bright Red for weapon
            ctx.lineWidth = 4;
            ctx.setLineDash([]); // Solid line
            ctx.strokeRect(x, y, width, height);

            // Draw Label
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(x, y - 30, width, 30);

            // Draw Text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px Inter';

            let displayLabel = prediction.class.toUpperCase();
            // Map proxy classes to 'WEAPON' for the UI
            if (displayLabel === 'HAIR DRIER' || displayLabel === 'REMOTE') {
                displayLabel = 'WEAPON';
            } else {
                displayLabel = `WEAPON (${displayLabel})`;
            }

            ctx.fillText(
                `⚠️ ${displayLabel} ${Math.round(prediction.score * 100)}%`,
                x + 5,
                y - 8
            );
        });
    }
}
