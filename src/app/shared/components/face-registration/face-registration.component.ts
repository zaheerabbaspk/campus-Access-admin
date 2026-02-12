import { Component, ElementRef, ViewChild, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FaceRecognitionService } from '../../../core/services/face-recognition.service';
import { StudentService } from '../../../core/services/student.service';

@Component({
    selector: 'app-face-registration',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="face-reg-container">
      <div class="camera-box">
        <video #video autoplay muted playsinline></video>
        <div class="scan-overlay" [class.scanning]="isScanning()"></div>
      </div>
      
      <div class="actions">
        <button (click)="startCamera()" *ngIf="!stream" class="primary-btn">Enable Camera</button>
        <button (click)="captureFace()" [disabled]="isScanning() || !faceService.isReady()" *ngIf="stream" class="primary-btn">
          {{ isScanning() ? 'Extracting biometric data...' : 'Register Face Identity' }}
        </button>
        <button (click)="stopCamera()" class="secondary-btn" *ngIf="stream">Close Camera</button>
      </div>

      <div class="status-msg" [class.success]="success()">
        {{ statusMessage() }}
      </div>
    </div>
  `,
    styles: [`
    .face-reg-container { 
      display: flex; 
      flex-direction: column; 
      align-items: center; 
      gap: 1.25rem; 
      padding: 1.5rem;
      background: #f8fafc;
      border-radius: 1rem;
    }
    .camera-box { 
      position: relative; 
      width: 100%;
      max-width: 400px; 
      aspect-ratio: 4/3; 
      background: #0f172a; 
      border-radius: 1rem; 
      overflow: hidden;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    }
    video { 
      width: 100%; 
      height: 100%; 
      object-fit: cover; 
      transform: scaleX(-1); 
    }
    .scan-overlay { 
      position: absolute; 
      inset: 0; 
      border: 3px solid rgba(255,255,255,0.1); 
      pointer-events: none;
      transition: all 0.3s ease;
    }
    .scanning { 
      border-color: #3b82f6; 
      box-shadow: inset 0 0 30px rgba(59, 130, 246, 0.3); 
    }
    .actions { 
      display: flex; 
      gap: 0.75rem; 
    }
    .primary-btn { 
      padding: 0.75rem 1.5rem; 
      border-radius: 0.5rem; 
      border: none; 
      background: #3b82f6; 
      color: white; 
      font-weight: 600; 
      cursor: pointer;
      transition: background 0.2s;
    }
    .primary-btn:hover:not(:disabled) { background: #2563eb; }
    .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    
    .secondary-btn { 
      padding: 0.75rem 1.5rem; 
      border-radius: 0.5rem; 
      border: 1px solid #e2e8f0; 
      background: white; 
      color: #64748b; 
      font-weight: 600; 
      cursor: pointer;
    }
    .status-msg { 
      font-size: 0.875rem; 
      color: #64748b; 
      text-align: center;
    }
    .status-msg.success { color: #22c55e; font-weight: 700; }
  `]
})
export class FaceRegistrationComponent {
    studentId = input.required<string>();
    saved = output<void>();

    @ViewChild('video') videoElement!: ElementRef<HTMLVideoElement>;

    faceService = inject(FaceRecognitionService);
    studentService = inject(StudentService);

    stream: MediaStream | null = null;
    isScanning = signal(false);
    statusMessage = signal('To register face, student must be in front of the camera.');
    success = signal(false);

    async startCamera() {
        this.statusMessage.set('Loading security modules...');
        await this.faceService.loadModels();

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' }
            });
            this.videoElement.nativeElement.srcObject = this.stream;
            this.statusMessage.set('Center face in the box and click Register');
        } catch (err) {
            this.statusMessage.set('Error: Camera permissions not granted.');
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    async captureFace() {
        if (!this.videoElement) return;

        this.isScanning.set(true);
        this.statusMessage.set('Analyzing biometric features...');

        try {
            const descriptor = await this.faceService.getFaceDescriptor(this.videoElement.nativeElement);

            if (descriptor) {
                this.studentService.updateFaceDescriptor(this.studentId(), descriptor);
                this.statusMessage.set('✓ Biometric Identity Registered Successfully!');
                this.success.set(true);
                setTimeout(() => {
                    this.saved.emit();
                    this.stopCamera();
                }, 2500);
            } else {
                this.statusMessage.set('Face not recognized clearly. Ensure proper lighting.');
            }
        } catch (err) {
            console.error('Biometric capture error:', err);
            this.statusMessage.set('Error during biometric scanning.');
        } finally {
            this.isScanning.set(false);
        }
    }
}
