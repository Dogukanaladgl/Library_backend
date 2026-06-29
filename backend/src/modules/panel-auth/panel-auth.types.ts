/** Kütüphane panel JWT payload — `type: panel` ile SUMOB/üniversite tokenlarından ayrılır */
export interface PanelJwtPayload {
  sub: string;
  studentNumber: string;
  role: string;
  isSuperAdmin: boolean;
  isStaffMember: boolean;
  type: 'panel';
}
