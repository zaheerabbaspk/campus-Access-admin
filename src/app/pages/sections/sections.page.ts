import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SectionService } from '../../core/services/section.service';
import { DepartmentService } from '../../core/services/department.service';

@Component({
    selector: 'app-sections',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './sections.page.html',
    styleUrls: ['./sections.page.scss']
})
export class SectionsPage implements OnInit {
    sectionService = inject(SectionService);
    departmentService = inject(DepartmentService);
    router = inject(Router);
    route = inject(ActivatedRoute);

    showAddModal = signal(false);
    isEditing = signal(false);
    editingId = signal<string | null>(null);

    sectionName = signal('');
    selectedDepartmentId = signal('');

    searchTerm = signal('');
    filterDepartmentId = signal('');

    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            if (params['departmentId']) {
                this.filterDepartmentId.set(params['departmentId']);
            }
        });
    }

    filteredSections = computed(() => {
        const term = this.searchTerm().toLowerCase();
        const filterDept = this.filterDepartmentId();

        return this.sectionService.sections().filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(term);
            const matchesDept = filterDept ? s.departmentId === filterDept : true;
            return matchesSearch && matchesDept;
        });
    });

    openAddModal() {
        this.isEditing.set(false);
        this.editingId.set(null);
        this.sectionName.set('');
        this.selectedDepartmentId.set('');
        this.showAddModal.set(true);
    }

    openEditModal(section: any) {
        this.isEditing.set(true);
        this.editingId.set(section.id);
        this.sectionName.set(section.name);
        this.selectedDepartmentId.set(section.departmentId);
        this.showAddModal.set(true);
    }

    closeAddModal() {
        this.showAddModal.set(false);
    }

    saveSection() {
        if (this.sectionName().trim() && this.selectedDepartmentId()) {
            if (this.isEditing() && this.editingId()) {
                this.sectionService.updateSection(
                    this.editingId()!,
                    this.sectionName().trim(),
                    this.selectedDepartmentId()
                );
            } else {
                this.sectionService.addSection(
                    this.sectionName().trim(),
                    this.selectedDepartmentId()
                );
            }
            this.closeAddModal();
        }
    }

    deleteSection(id: string) {
        if (confirm('Are you sure you want to delete this section?')) {
            this.sectionService.deleteSection(id);
        }
    }

    getDepartmentName(id: string): string {
        return this.departmentService.getDepartmentById(id)?.name || 'Unknown';
    }

    navigateToStudents(sectionId: string) {
        this.router.navigate(['/students'], { queryParams: { sectionId } });
    }
}
