import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../core/services/theme.service';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-header',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
    themeService = inject(ThemeService);
    authService = inject(AuthService);
    router = inject(Router);

    toggleSidebar = output<void>();

    onToggleSidebar() {
        this.toggleSidebar.emit();
    }

    onToggleTheme() {
        this.themeService.toggleTheme();
    }

    onLogout() {
        this.authService.logout();
        this.router.navigate(['/login']);
    }
}
