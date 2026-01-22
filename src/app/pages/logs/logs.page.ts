import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LogService } from '../../core/services/log.service';
import { DepartmentService } from '../../core/services/department.service';
import { SectionService } from '../../core/services/section.service';

@Component({
    selector: 'app-logs',
    standalone: true,
    imports: [CommonModule, FormsModule, DatePipe],
    templateUrl: './logs.page.html',
    styleUrls: ['./logs.page.scss']
})
export class LogsPage {
    logService = inject(LogService);
    departmentService = inject(DepartmentService);
    sectionService = inject(SectionService);

    // Filters
    searchTerm = signal('');
    filterDepartmentId = signal('');
    filterSectionId = signal('');
    startDate = signal('');
    endDate = signal('');

    // Computed
    filterSectionsList = computed(() => {
        const deptId = this.filterDepartmentId();
        return deptId ? this.sectionService.sections().filter(s => s.departmentId === deptId) : [];
    });

    filteredLogs = computed(() => {
        const term = this.searchTerm().toLowerCase();
        const fDept = this.filterDepartmentId();
        const fSec = this.filterSectionId();
        const start = this.startDate() ? new Date(this.startDate()) : null;
        const end = this.endDate() ? new Date(this.endDate()) : null;

        // Adjust end date to include the entire day
        if (end) {
            end.setHours(23, 59, 59, 999);
        }

        return this.logService.logs().filter(log => {
            const logDate = new Date(log.timestamp);

            const matchesSearch =
                log.studentName.toLowerCase().includes(term) ||
                log.studentId.toLowerCase().includes(term);

            const matchesDept = fDept ? log.departmentId === fDept : true;
            const matchesSec = fSec ? log.sectionId === fSec : true;
            const matchesStart = start ? logDate >= start : true;
            const matchesEnd = end ? logDate <= end : true;

            return matchesSearch && matchesDept && matchesSec && matchesStart && matchesEnd;
        });
    });

    getDepartmentName(id: string): string {
        return this.departmentService.getDepartmentById(id)?.name || 'Unknown';
    }

    getSectionName(id: string): string {
        return this.sectionService.sections().find(s => s.id === id)?.name || 'Unknown';
    }

    getStatusColor(status: string): string {
        return status.includes('Success') ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' :
            'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
    }
}
