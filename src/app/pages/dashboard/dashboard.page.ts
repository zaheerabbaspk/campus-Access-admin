import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudentService } from '../../core/services/student.service';
import { DepartmentService } from '../../core/services/department.service';
import { SectionService } from '../../core/services/section.service';
import { LogService } from '../../core/services/log.service';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './dashboard.page.html',
    styleUrls: ['./dashboard.page.scss']
})
export class DashboardPage {
    studentService = inject(StudentService);
    departmentService = inject(DepartmentService);
    sectionService = inject(SectionService);
    logService = inject(LogService);

    totalStudents = computed(() => this.studentService.students().length);
    totalDepartments = computed(() => this.departmentService.departments().length);
    totalSections = computed(() => this.sectionService.sections().length);
    totalLogs = computed(() => this.logService.logs().length);

    lastStudent = computed(() => {
        const students = this.studentService.students();
        return students.length > 0 ? students[students.length - 1] : null;
    });

    recentLogs = computed(() => this.logService.logs().slice(0, 5));

    getDepartmentName(id: string): string {
        return this.departmentService.getDepartmentById(id)?.name || 'Unknown';
    }
}
