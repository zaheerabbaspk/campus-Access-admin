import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DepartmentService } from '../../core/services/department.service';

@Component({
    selector: 'app-departments',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './departments.page.html',
    styleUrls: ['./departments.page.scss']
})
export class DepartmentsPage {
    departmentService = inject(DepartmentService);
    router = inject(Router);

    showAddModal = signal(false);
    isEditing = signal(false);
    editingId = signal<string | null>(null);

    departmentName = signal('');
    departmentCode = signal('');
    searchTerm = signal('');

    filteredDepartments = computed(() => {
        const term = this.searchTerm().toLowerCase();
        return this.departmentService.departments().filter(d =>
            d.name.toLowerCase().includes(term) ||
            (d.code?.toLowerCase().includes(term) ?? false)
        );
    });

    openAddModal() {
        this.isEditing.set(false);
        this.editingId.set(null);
        this.departmentName.set('');
        this.departmentCode.set('');
        this.showAddModal.set(true);
    }

    openEditModal(dept: any) {
        this.isEditing.set(true);
        this.editingId.set(dept.id);
        this.departmentName.set(dept.name);
        this.departmentCode.set(dept.code || '');
        this.showAddModal.set(true);
    }

    closeAddModal() {
        this.showAddModal.set(false);
    }

    saveDepartment() {
        if (this.departmentName().trim()) {
            if (this.isEditing() && this.editingId()) {
                this.departmentService.updateDepartment(
                    this.editingId()!,
                    this.departmentName().trim(),
                    this.departmentCode().trim() || undefined
                );
            } else {
                this.departmentService.addDepartment(
                    this.departmentName().trim(),
                    this.departmentCode().trim() || undefined
                );
            }
            this.closeAddModal();
        }
    }

    deleteDepartment(id: string) {
        if (confirm('Are you sure you want to delete this department?')) {
            this.departmentService.deleteDepartment(id);
        }
    }

    navigateToSections(departmentId: string) {
        this.router.navigate(['/sections'], { queryParams: { departmentId } });
    }
}
