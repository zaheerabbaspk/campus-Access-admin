export interface Department {
    id: string;
    name: string;
    code?: string;
}

export interface Section {
    id: string;
    name: string;
    departmentId: string;
}

export interface Student {
    id: string; // Roll Number / Student ID
    name: string;
    fatherName: string;
    email: string;
    phone: string;
    departmentId: string;
    sectionId: string;
    year: string;
    semester: string;
    photoUrl?: string;
    registeredAt: Date;
}

export interface EntryLog {
    id: string;
    studentId: string;
    studentName: string;
    departmentId: string;
    sectionId: string;
    timestamp: Date;
    status: string;
}

export interface AuditLog {
    id: string;
    action: 'Create' | 'Update' | 'Delete';
    entity: 'Department' | 'Section' | 'Student';
    details: string;
    timestamp: Date;
    user: string;
}
