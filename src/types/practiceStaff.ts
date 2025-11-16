export interface StaffMember {
  id: string;
  name: string;
  role: 'admin' | 'provider' | 'staff';
  email?: string;
  phone?: string;
  active?: boolean;
}

export interface PracticeAssignableUser {
  id: string;
  name: string;
  role: string;
  role_display: string;
  staff_role_type: string;
  email?: string;
  phone?: string;
}
