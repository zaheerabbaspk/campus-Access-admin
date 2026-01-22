import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditLogService } from '../../core/services/audit-log.service';

@Component({
    selector: 'app-audit-logs',
    standalone: true,
    imports: [CommonModule, FormsModule, DatePipe],
    templateUrl: './audit-logs.page.html',
    styleUrls: ['./audit-logs.page.scss']
})
export class AuditLogsPage {
    auditLogService = inject(AuditLogService);

    // Filters
    filterEntity = signal('');
    filterAction = signal('');

    filteredLogs = computed(() => {
        const entity = this.filterEntity();
        const action = this.filterAction();

        return this.auditLogService.logs().filter(log => {
            const matchesEntity = entity ? log.entity === entity : true;
            const matchesAction = action ? log.action === action : true;
            return matchesEntity && matchesAction;
        });
    });

    getActionColor(action: string): string {
        switch (action) {
            case 'Create': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
            case 'Update': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
            case 'Delete': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
            default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800';
        }
    }

    clearLogs() {
        if (confirm('Are you sure you want to clear all audit logs? This cannot be undone.')) {
            this.auditLogService.clearLogs();
        }
    }
}
