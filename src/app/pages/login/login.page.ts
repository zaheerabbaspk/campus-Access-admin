import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './login.page.html',
    styleUrls: ['./login.page.scss']
})
export class LoginPage {
    authService = inject(AuthService);
    router = inject(Router);

    password = signal('');
    error = signal('');
    showPassword = signal(false);

    onSubmit() {
        if (this.authService.login(this.password())) {
            this.router.navigate(['/dashboard']);
        } else {
            this.error.set('Invalid password. Try "admin123"');
        }
    }

    togglePasswordVisibility() {
        this.showPassword.update(v => !v);
    }
}
