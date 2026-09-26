import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppLayout } from './layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UnitsPage } from './pages/UnitsPage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { UsersPage } from './pages/UsersPage';
import { EquipmentTypesPage } from './pages/EquipmentTypesPage';
import { EquipmentListPage } from './pages/EquipmentListPage';
import { EquipmentDetailPage } from './pages/EquipmentDetailPage';
import { EquipmentImportPage } from './pages/EquipmentImportPage';
import { ChecklistTemplatesPage } from './pages/ChecklistTemplatesPage';
import { ChecklistTemplateDetailPage } from './pages/ChecklistTemplateDetailPage';
import { ChecklistVersionEditorPage } from './pages/ChecklistVersionEditorPage';
import { EquipmentLabelPage } from './pages/EquipmentLabelPage';
import { QrShortRedirectPage } from './pages/QrShortRedirectPage';
import { InspectionsPage } from './pages/InspectionsPage';
import { InspectionDetailPage } from './pages/InspectionDetailPage';
import { InspectionPerformPage } from './pages/InspectionPerformPage';
import { CorrectiveActionsPage } from './pages/CorrectiveActionsPage';
import { CorrectiveActionDetailPage } from './pages/CorrectiveActionDetailPage';
import { ReportsLandingPage } from './pages/reports/ReportsLandingPage';
import { ComplianceReportPage } from './pages/reports/ComplianceReportPage';
import { UnitComplianceReportPage } from './pages/reports/UnitComplianceReportPage';
import { EquipmentHistoryReportPage } from './pages/reports/EquipmentHistoryReportPage';
import { FailedEquipmentReportPage } from './pages/reports/FailedEquipmentReportPage';
import { CorrectiveActionsReportPage } from './pages/reports/CorrectiveActionsReportPage';
import { EquipmentInspectionLogReportPage } from './pages/reports/EquipmentInspectionLogReportPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PERMS } from './lib/permissions';

// Heavy pages get code-split: html5-qrcode is ~350 kB and QR label
// grids only matter to admins.
const ScanPage = lazy(() =>
  import('./pages/ScanPage').then((m) => ({ default: m.ScanPage })),
);
const QrBulkPage = lazy(() =>
  import('./pages/QrBulkPage').then((m) => ({ default: m.QrBulkPage })),
);

function SuspenseFallback() {
  return (
    <div className="p-6 text-sm text-slate-500">Loading…</div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />

            <Route element={<ProtectedRoute requirePermissions={[PERMS.UNIT_VIEW]} />}>
              <Route path="units" element={<UnitsPage />} />
            </Route>
            <Route element={<ProtectedRoute requirePermissions={[PERMS.DEPARTMENT_VIEW]} />}>
              <Route path="departments" element={<DepartmentsPage />} />
            </Route>
            <Route element={<ProtectedRoute requirePermissions={[PERMS.USER_VIEW]} />}>
              <Route path="users" element={<UsersPage />} />
            </Route>

            <Route element={<ProtectedRoute requirePermissions={[PERMS.EQUIPMENT_VIEW]} />}>
              <Route path="equipment" element={<EquipmentListPage />} />
              <Route path="equipment/:id" element={<EquipmentDetailPage />} />
              <Route path="equipment/:id/label" element={<EquipmentLabelPage />} />
              <Route
                path="scan"
                element={
                  <Suspense fallback={<SuspenseFallback />}>
                    <ScanPage />
                  </Suspense>
                }
              />
              <Route path="s/:value" element={<QrShortRedirectPage />} />
            </Route>
            <Route element={<ProtectedRoute requirePermissions={[PERMS.EQUIPMENT_MANAGE]} />}>
              <Route path="equipment/import" element={<EquipmentImportPage />} />
              <Route
                path="qr-bulk"
                element={
                  <Suspense fallback={<SuspenseFallback />}>
                    <QrBulkPage />
                  </Suspense>
                }
              />
            </Route>
            <Route element={<ProtectedRoute requirePermissions={[PERMS.EQUIPMENT_VIEW]} />}>
              <Route path="equipment-types" element={<EquipmentTypesPage />} />
            </Route>

            <Route element={<ProtectedRoute requirePermissions={[PERMS.CHECKLIST_VIEW]} />}>
              <Route path="checklist-templates" element={<ChecklistTemplatesPage />} />
              <Route
                path="checklist-templates/:id"
                element={<ChecklistTemplateDetailPage />}
              />
              <Route
                path="checklist-templates/:templateId/versions/:versionId"
                element={<ChecklistVersionEditorPage />}
              />
            </Route>

            <Route element={<ProtectedRoute requirePermissions={[PERMS.INSPECTION_VIEW]} />}>
              <Route path="inspections" element={<InspectionsPage />} />
              <Route path="inspections/:id" element={<InspectionDetailPage />} />
            </Route>
            <Route element={<ProtectedRoute requirePermissions={[PERMS.INSPECTION_PERFORM]} />}>
              <Route
                path="inspections/:id/perform"
                element={<InspectionPerformPage />}
              />
            </Route>

            <Route element={<ProtectedRoute requirePermissions={[PERMS.CORRECTIVE_ACTION_VIEW]} />}>
              <Route path="corrective-actions" element={<CorrectiveActionsPage />} />
              <Route
                path="corrective-actions/:id"
                element={<CorrectiveActionDetailPage />}
              />
            </Route>

            {/* Placeholders — delivered in later phases */}
            <Route element={<ProtectedRoute requirePermissions={[PERMS.REPORT_VIEW]} />}>
              <Route path="reports" element={<ReportsLandingPage />} />
              <Route path="reports/compliance" element={<ComplianceReportPage />} />
              <Route
                path="reports/unit-compliance"
                element={<UnitComplianceReportPage />}
              />
              <Route
                path="reports/equipment-history"
                element={<EquipmentHistoryReportPage />}
              />
              <Route
                path="reports/equipment-inspection-log"
                element={<EquipmentInspectionLogReportPage />}
              />
              <Route
                path="reports/failed-equipment"
                element={<FailedEquipmentReportPage />}
              />
              <Route
                path="reports/corrective-actions"
                element={<CorrectiveActionsReportPage />}
              />
            </Route>
            <Route element={<ProtectedRoute requirePermissions={[PERMS.AUDIT_VIEW]} />}>
              <Route path="audit-logs" element={<AuditLogsPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
