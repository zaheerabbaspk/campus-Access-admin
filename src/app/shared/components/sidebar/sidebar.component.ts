import { Component, input, output, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DepartmentService } from '../../../core/services/department.service';
import { SectionService } from '../../../core/services/section.service';
import { StudentService } from '../../../core/services/student.service';
import { LogService } from '../../../core/services/log.service';
import { AuditLogService } from '../../../core/services/audit-log.service';

interface NavItem {
    label: string;
    route: string;
    icon: string;
    count?: () => number;
}

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './sidebar.component.html',
    styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
    private departmentService = inject(DepartmentService);
    private sectionService = inject(SectionService);
    private studentService = inject(StudentService);
    private logService = inject(LogService);
    private auditLogService = inject(AuditLogService);

    isOpen = input<boolean>(true);
    closeSidebar = output<void>();

    // Computed counts
    deptCount = computed(() => this.departmentService.departments().length);
    sectionCount = computed(() => this.sectionService.sections().length);
    studentCount = computed(() => this.studentService.students().length);
    logCount = computed(() => this.logService.logs().length);
    auditLogCount = computed(() => this.auditLogService.logs().length);

    navItems: NavItem[] = [
        { label: 'Dashboard', route: '/dashboard', icon: 'home' },
        { label: 'Departments', route: '/departments', icon: 'building', count: this.deptCount },
        { label: 'Sections', route: '/sections', icon: 'grid', count: this.sectionCount },
        { label: 'Students', route: '/students', icon: 'users', count: this.studentCount },
        { label: 'Entry Logs', route: '/logs', icon: 'clipboard', count: this.logCount },
        { label: 'Audit Logs', route: '/audit-logs', icon: 'shield', count: this.auditLogCount }
    ];

    onCloseSidebar() {
        this.closeSidebar.emit();
    }

    getIconPath(icon: string): string {
        const icons: Record<string, string> = {
            home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
            building: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
            grid: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
            users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
            clipboard: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
            shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
        };
        return icons[icon] || '';
    }
}
