import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { StudentService } from '../../core/services/student.service';
import { DepartmentService } from '../../core/services/department.service';
import { SectionService } from '../../core/services/section.service';
import { FaceRegistrationComponent } from '../../shared/components/face-registration/face-registration.component';

@Component({
    selector: 'app-students',
    standalone: true,
    imports: [CommonModule, FormsModule, FaceRegistrationComponent],
    templateUrl: './students.page.html',
    styleUrls: ['./students.page.scss']
})
export class StudentsPage implements OnInit {
    studentService = inject(StudentService);
    departmentService = inject(DepartmentService);
    sectionService = inject(SectionService);
    route = inject(ActivatedRoute);

    showAddModal = signal(false);
    showFaceModal = signal(false);
    isEditing = signal(false);
    selectedStudentForFace = signal<string | null>(null);

    // Filters
    searchTerm = signal('');
    filterDepartmentId = signal('');
    filterSectionId = signal('');
    filterYear = signal('');
    filterSemester = signal('');

    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            if (params['sectionId']) {
                const sectionId = params['sectionId'];
                this.filterSectionId.set(sectionId);

                // Also set department filter if we can find the section
                const section = this.sectionService.sections().find(s => s.id === sectionId);
                if (section) {
                    this.filterDepartmentId.set(section.departmentId);
                }
            }
        });
    }

    // Form fields
    studentId = signal('');
    name = signal('');
    fatherName = signal('');
    email = signal('');
    phone = signal('');
    selectedDepartmentId = signal('');
    selectedSectionId = signal('');
    year = signal('');
    semester = signal('');
    registeredAt = signal<Date | undefined>(undefined);
    editingFirebaseId = signal<string | undefined>(undefined); // Store Firebase ID when editing

    // Computed
    filteredSections = computed(() => {
        const deptId = this.selectedDepartmentId();
        return deptId ? this.sectionService.sections().filter(s => s.departmentId === deptId) : [];
    });

    filterSectionsList = computed(() => {
        const deptId = this.filterDepartmentId();
        return deptId ? this.sectionService.sections().filter(s => s.departmentId === deptId) : [];
    });

    filteredStudents = computed(() => {
        const term = this.searchTerm().toLowerCase();
        const fDept = this.filterDepartmentId();
        const fSec = this.filterSectionId();
        const fYear = this.filterYear();
        const fSem = this.filterSemester();

        return this.studentService.students().filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(term) || s.id.toLowerCase().includes(term);
            const matchesDept = fDept ? s.departmentId === fDept : true;
            const matchesSec = fSec ? s.sectionId === fSec : true;
            const matchesYear = fYear ? s.year === fYear : true;
            const matchesSem = fSem ? s.semester === fSem : true;

            return matchesSearch && matchesDept && matchesSec && matchesYear && matchesSem;
        });
    });

    openAddModal() {
        this.isEditing.set(false);
        this.resetForm();
        this.showAddModal.set(true);
    }

    openEditModal(student: any) {
        this.isEditing.set(true);
        this.studentId.set(student.id); // This is now the roll number
        this.editingFirebaseId.set(student.firebaseId); // Store Firebase ID
        this.name.set(student.name);
        this.fatherName.set(student.fatherName || '');
        this.email.set(student.email || '');
        this.phone.set(student.phone || '');
        this.selectedDepartmentId.set(student.departmentId);
        this.selectedSectionId.set(student.sectionId);
        this.year.set(student.year || '');
        this.semester.set(student.semester || '');
        this.registeredAt.set(student.registeredAt); // Preserve this
        this.showAddModal.set(true);
    }

    closeAddModal() {
        this.showAddModal.set(false);
    }

    openFaceModal(firebaseId: string) {
        this.selectedStudentForFace.set(firebaseId);
        this.showFaceModal.set(true);
    }

    closeFaceModal() {
        this.showFaceModal.set(false);
        this.selectedStudentForFace.set(null);
    }

    resetForm() {
        this.studentId.set('');
        this.name.set('');
        this.fatherName.set('');
        this.email.set('');
        this.phone.set('');
        this.selectedDepartmentId.set('');
        this.selectedSectionId.set('');
        this.year.set('');
        this.semester.set('');
        this.registeredAt.set(undefined);
        this.editingFirebaseId.set(undefined);
    }

    saveStudent() {
        if (this.studentId().trim() && this.name().trim() && this.selectedDepartmentId() && this.selectedSectionId()) {
            const studentData = {
                id: this.studentId().trim(),
                name: this.name().trim(),
                fatherName: this.fatherName().trim(),
                email: this.email().trim(),
                phone: this.phone().trim(),
                departmentId: this.selectedDepartmentId(),
                sectionId: this.selectedSectionId(),
                year: this.year().trim(),
                semester: this.semester().trim()
            };

            if (this.isEditing()) {
                this.studentService.updateStudent({
                    ...studentData,
                    firebaseId: this.editingFirebaseId()!,
                    registeredAt: this.registeredAt() ?? new Date() // Keep original date or use current if missing
                });
            } else {
                this.studentService.addStudent(studentData);
            }
            this.closeAddModal();
        }
    }

    deleteStudent(firebaseId: string) {
        if (confirm('Are you sure you want to delete this student?')) {
            this.studentService.deleteStudent(firebaseId);
        }
    }

    getDepartmentName(id: string): string {
        return this.departmentService.getDepartmentById(id)?.name || 'Unknown';
    }

    getSectionName(id: string): string {
        return this.sectionService.sections().find(s => s.id === id)?.name || 'Unknown';
    }
}
