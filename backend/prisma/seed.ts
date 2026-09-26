/**
 * Prisma seed
 *
 * Phase 1 seed:
 *   - Roles and their permissions (idempotent upsert)
 *   - Three demo units (A, B, C) with a few departments each
 *   - Five demo users, one per role
 *
 * Business data (equipment, checklists, inspections) is seeded in
 * later phases.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  PERMISSION_KEYS,
  ROLE_KEYS,
  ROLE_PERMISSIONS,
  type PermissionKey,
  type RoleKey,
} from '../src/lib/rbac.js';

const prisma = new PrismaClient();

const ROLE_META: Record<
  RoleKey,
  { name: string; description: string }
> = {
  SUPER_ADMIN: {
    name: 'Super Admin',
    description: 'Full system access across all units.',
  },
  CENTRAL_ADMIN: {
    name: 'Central Fire/Safety Admin',
    description: 'Manages equipment, templates, inspections and reports across units.',
  },
  UNIT_ADMIN: {
    name: 'Unit Admin',
    description: 'Manages equipment, inspections and users within one unit.',
  },
  INSPECTOR: {
    name: 'Inspector',
    description: 'Performs monthly inspections and raises corrective actions.',
  },
  VIEWER: {
    name: 'Viewer',
    description: 'Read-only access to dashboards, equipment and reports.',
  },
};

const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  'user.manage': 'Create, update, activate/deactivate users and reset passwords.',
  'user.view': 'View users and their assignments.',
  'role.manage': 'Manage roles and role-permission mappings.',
  'unit.manage': 'Create and update units.',
  'unit.view': 'View units.',
  'department.manage': 'Create and update departments.',
  'department.view': 'View departments.',
  'equipment.manage': 'Create and update equipment records.',
  'equipment.view': 'View equipment records.',
  'checklist.manage': 'Create and update checklist templates.',
  'checklist.view': 'View checklist templates.',
  'inspection.perform': 'Start and submit monthly inspections.',
  'inspection.view': 'View inspection records.',
  'corrective_action.create': 'Raise corrective actions.',
  'corrective_action.close': 'Close/resolve corrective actions.',
  'corrective_action.view': 'View corrective actions.',
  'report.view': 'View compliance and equipment reports.',
  'audit.view': 'View audit logs.',
};

async function upsertPermissions() {
  for (const key of Object.values(PERMISSION_KEYS)) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, description: PERMISSION_DESCRIPTIONS[key as PermissionKey] },
      update: { description: PERMISSION_DESCRIPTIONS[key as PermissionKey] },
    });
  }
}

async function upsertRolesAndPermissions() {
  for (const roleKey of Object.values(ROLE_KEYS)) {
    const meta = ROLE_META[roleKey as RoleKey];
    const role = await prisma.role.upsert({
      where: { key: roleKey },
      create: {
        key: roleKey,
        name: meta.name,
        description: meta.description,
        isSystem: true,
      },
      update: {
        name: meta.name,
        description: meta.description,
        isSystem: true,
      },
    });

    const grantedKeys = ROLE_PERMISSIONS[roleKey as RoleKey];
    const permissions = await prisma.permission.findMany({
      where: { key: { in: grantedKeys as string[] } },
    });

    // Reset the mapping so seed changes propagate deterministically.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
  }
}

async function upsertUnits() {
  // Trimmed for lighter testing — a single plant with three departments.
  // Reinstate more units by adding rows here and re-seeding.
  const units = [
    {
      code: 'UNIT-A',
      name: 'UPL Unit A',
      location: 'Ankleshwar, Gujarat',
      description: 'Formulations plant',
      departments: [
        { code: 'PROD', name: 'Production' },
        { code: 'MAINT', name: 'Maintenance' },
        { code: 'ADMIN', name: 'Administration' },
      ],
    },
  ];

  const created: Record<string, { id: string; departments: Record<string, string> }> = {};

  for (const u of units) {
    const unit = await prisma.unit.upsert({
      where: { code: u.code },
      create: {
        code: u.code,
        name: u.name,
        location: u.location,
        description: u.description,
      },
      update: {
        name: u.name,
        location: u.location,
        description: u.description,
      },
    });
    const depts: Record<string, string> = {};
    for (const d of u.departments) {
      const dept = await prisma.department.upsert({
        where: { unitId_code: { unitId: unit.id, code: d.code } },
        create: {
          unitId: unit.id,
          code: d.code,
          name: d.name,
        },
        update: { name: d.name },
      });
      depts[d.code] = dept.id;
    }
    created[u.code] = { id: unit.id, departments: depts };
  }
  return created;
}

interface DemoUserSpec {
  username: string;
  fullName: string;
  email: string;
  password: string;
  roleKey: RoleKey;
  unitCode?: string;
  departmentCode?: string;
  employeeId?: string;
  designation?: string;
}

async function upsertUsers(
  units: Awaited<ReturnType<typeof upsertUnits>>,
) {
  const users: DemoUserSpec[] = [
    {
      username: 'admin',
      fullName: 'System Administrator',
      email: 'admin@upl.example',
      password: 'Admin@123',
      roleKey: ROLE_KEYS.SUPER_ADMIN,
      employeeId: 'EMP-000001',
      designation: 'System Administrator',
    },
    {
      username: 'centraladmin',
      fullName: 'Central Fire Safety Admin',
      email: 'centraladmin@upl.example',
      password: 'Central@123',
      roleKey: ROLE_KEYS.CENTRAL_ADMIN,
      employeeId: 'EMP-000002',
      designation: 'Central Fire Safety Officer',
    },
    {
      username: 'unitadmin',
      fullName: 'Unit A Administrator',
      email: 'unitadmin@upl.example',
      password: 'UnitAdmin@123',
      roleKey: ROLE_KEYS.UNIT_ADMIN,
      unitCode: 'UNIT-A',
      departmentCode: 'ADMIN',
      employeeId: 'EMP-000003',
      designation: 'Unit Fire Safety Officer',
    },
    {
      username: 'inspector',
      fullName: 'Field Inspector',
      email: 'inspector@upl.example',
      password: 'Inspector@123',
      roleKey: ROLE_KEYS.INSPECTOR,
      unitCode: 'UNIT-A',
      departmentCode: 'MAINT',
      employeeId: 'EMP-000004',
      designation: 'Fire Safety Inspector',
    },
    {
      username: 'viewer',
      fullName: 'Read-only Viewer',
      email: 'viewer@upl.example',
      password: 'Viewer@123',
      roleKey: ROLE_KEYS.VIEWER,
      unitCode: 'UNIT-A',
      employeeId: 'EMP-000005',
      designation: 'Auditor',
    },
  ];

  for (const spec of users) {
    const role = await prisma.role.findUnique({ where: { key: spec.roleKey } });
    if (!role) throw new Error(`Role ${spec.roleKey} not seeded`);

    const unit = spec.unitCode ? units[spec.unitCode] : undefined;
    const departmentId =
      unit && spec.departmentCode ? unit.departments[spec.departmentCode] : null;

    const passwordHash = await bcrypt.hash(spec.password, 10);

    await prisma.user.upsert({
      where: { username: spec.username },
      create: {
        username: spec.username,
        fullName: spec.fullName,
        email: spec.email,
        employeeId: spec.employeeId,
        designation: spec.designation,
        passwordHash,
        roleId: role.id,
        unitId: unit?.id ?? null,
        departmentId,
      },
      update: {
        fullName: spec.fullName,
        email: spec.email,
        employeeId: spec.employeeId,
        designation: spec.designation,
        // password intentionally NOT overwritten on re-seed so operators
        // don't have their passwords reset unexpectedly.
        roleId: role.id,
        unitId: unit?.id ?? null,
        departmentId,
        isActive: true,
      },
    });
  }
}

const EQUIPMENT_TYPES: Array<{
  key: string;
  name: string;
  description: string;
  inspectionFrequencyDays: number;
}> = [
  {
    key: 'FIRE_EXTINGUISHER',
    name: 'Fire Extinguisher',
    description: 'Portable extinguisher (ABC/CO2/foam).',
    inspectionFrequencyDays: 30,
  },
  {
    key: 'HYDRANT',
    name: 'Hydrant',
    description: 'Outdoor / indoor hydrant point.',
    inspectionFrequencyDays: 30,
  },
  {
    key: 'HOSE_REEL',
    name: 'Hose Reel',
    description: 'Fixed hose reel with valve.',
    inspectionFrequencyDays: 30,
  },
  {
    key: 'FIRE_PUMP',
    name: 'Fire Pump',
    description: 'Jockey / main / diesel fire pump.',
    inspectionFrequencyDays: 30,
  },
  {
    key: 'SMOKE_DETECTOR',
    name: 'Smoke Detector',
    description: 'Ceiling-mounted smoke detector.',
    inspectionFrequencyDays: 30,
  },
];

async function upsertEquipmentTypes(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const t of EQUIPMENT_TYPES) {
    const item = await prisma.equipmentType.upsert({
      where: { key: t.key },
      create: t,
      update: {
        name: t.name,
        description: t.description,
        inspectionFrequencyDays: t.inspectionFrequencyDays,
      },
    });
    map[t.key] = item.id;
  }
  return map;
}

/**
 * Seed sample equipment. Trimmed for lighter testing:
 *   2 of every equipment type, all in UNIT-A. 10 items total.
 * Idempotent: existing equipment_codes are skipped.
 */
async function upsertSampleEquipment(
  units: Awaited<ReturnType<typeof upsertUnits>>,
  typeIds: Record<string, string>,
) {
  const shortUnit = (code: string) =>
    code.replace(/^UNIT-?/i, '').toUpperCase() || code;
  const shortType = (key: string) =>
    key
      .split('_')
      .map((p) => p[0] ?? '')
      .join('')
      .toUpperCase();

  const distributions: Array<{
    typeKey: string;
    perUnit: Array<{ unitCode: string; count: number; deptCode?: string }>;
    manufacturer: string;
    capacityPool?: string[];
  }> = [
    {
      typeKey: 'FIRE_EXTINGUISHER',
      manufacturer: 'Acme Safety',
      capacityPool: ['4 kg', '6 kg'],
      perUnit: [{ unitCode: 'UNIT-A', count: 2, deptCode: 'PROD' }],
    },
    {
      typeKey: 'HYDRANT',
      manufacturer: 'Newage',
      perUnit: [{ unitCode: 'UNIT-A', count: 2, deptCode: 'MAINT' }],
    },
    {
      typeKey: 'HOSE_REEL',
      manufacturer: 'Newage',
      perUnit: [{ unitCode: 'UNIT-A', count: 2, deptCode: 'MAINT' }],
    },
    {
      typeKey: 'FIRE_PUMP',
      manufacturer: 'Kirloskar',
      capacityPool: ['171 m³/h', '410 m³/h'],
      perUnit: [{ unitCode: 'UNIT-A', count: 2, deptCode: 'MAINT' }],
    },
    {
      typeKey: 'SMOKE_DETECTOR',
      manufacturer: 'Honeywell',
      perUnit: [{ unitCode: 'UNIT-A', count: 2, deptCode: 'PROD' }],
    },
  ];

  let created = 0;
  let skipped = 0;

  for (const dist of distributions) {
    const typeId = typeIds[dist.typeKey];
    for (const perUnit of dist.perUnit) {
      const unit = units[perUnit.unitCode];
      if (!unit) continue;
      const departmentId =
        perUnit.deptCode && unit.departments[perUnit.deptCode]
          ? unit.departments[perUnit.deptCode]
          : null;

      for (let i = 1; i <= perUnit.count; i++) {
        const equipmentCode = `${shortType(dist.typeKey)}-${shortUnit(perUnit.unitCode)}-${String(
          i,
        ).padStart(4, '0')}`;
        const existing = await prisma.equipment.findUnique({
          where: { equipmentCode },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          continue;
        }

        // Fresh, unique QR value.
        let qrCodeValue = '';
        for (let attempt = 0; attempt < 5; attempt++) {
          const { randomBytes } = await import('node:crypto');
          const candidate = 'EQ-' + randomBytes(6).toString('hex').toUpperCase();
          const clash = await prisma.equipment.findUnique({
            where: { qrCodeValue: candidate },
            select: { id: true },
          });
          if (!clash) {
            qrCodeValue = candidate;
            break;
          }
        }
        if (!qrCodeValue) {
          throw new Error('Could not allocate a unique QR value during seed');
        }

        await prisma.equipment.create({
          data: {
            equipmentCode,
            qrCodeValue,
            name: `${dist.typeKey
              .split('_')
              .map((w) => w[0] + w.slice(1).toLowerCase())
              .join(' ')} #${i} (${shortUnit(perUnit.unitCode)})`,
            equipmentTypeId: typeId,
            unitId: unit.id,
            departmentId,
            serialNumber: `${shortType(dist.typeKey)}-SN-${shortUnit(perUnit.unitCode)}-${String(i).padStart(4, '0')}`,
            manufacturer: dist.manufacturer,
            capacity:
              dist.capacityPool?.[(i - 1) % dist.capacityPool.length] ?? null,
            assetNumber: `ASSET-${shortUnit(perUnit.unitCode)}-${String(created + 1).padStart(5, '0')}`,
            installationDate: new Date(
              2022,
              (i - 1) % 12,
              ((i - 1) % 27) + 1,
            ),
            area:
              dist.typeKey === 'SMOKE_DETECTOR' ? 'Ceiling zone' : 'Ground floor',
            building: `Block ${String.fromCharCode(65 + ((i - 1) % 3))}`,
            floor: 'Ground',
            location: `Near marker ${i}`,
            status: 'ACTIVE',
          },
        });
        created++;
      }
    }
  }

  return { created, skipped };
}

interface SeededSection {
  title: string;
  description?: string;
  questions: Array<{
    text: string;
    helpText?: string;
    questionType:
      | 'PASS_FAIL'
      | 'YES_NO'
      | 'NUMERIC'
      | 'TEXT'
      | 'DROPDOWN'
      | 'DATE'
      | 'PHOTO'
      | 'REMARKS';
    isMandatory: boolean;
    isSafetyCritical?: boolean;
    requiresCorrectiveActionOnFail?: boolean;
    options?: string[];
    numericMin?: number;
    numericMax?: number;
    numericUnit?: string;
  }>;
}

interface SeededTemplate {
  name: string;
  description: string;
  equipmentTypeKey: string;
  frequencyDays: number;
  sections: SeededSection[];
}

const CHECKLIST_TEMPLATES: SeededTemplate[] = [
  {
    name: 'Monthly Fire Extinguisher Check',
    description: 'Standard monthly visual and mechanical inspection.',
    equipmentTypeKey: 'FIRE_EXTINGUISHER',
    frequencyDays: 30,
    sections: [
      {
        title: 'Visual condition',
        questions: [
          {
            text: 'Is the extinguisher in its assigned location?',
            questionType: 'YES_NO',
            isMandatory: true,
            isSafetyCritical: true,
            requiresCorrectiveActionOnFail: true,
          },
          {
            text: 'Is the safety pin and seal intact?',
            questionType: 'YES_NO',
            isMandatory: true,
            isSafetyCritical: true,
            requiresCorrectiveActionOnFail: true,
          },
          {
            text: 'Is the body free of dents, corrosion, or damage?',
            questionType: 'PASS_FAIL',
            isMandatory: true,
            requiresCorrectiveActionOnFail: true,
          },
          {
            text: 'Is the operating label / instructions legible?',
            questionType: 'PASS_FAIL',
            isMandatory: true,
          },
        ],
      },
      {
        title: 'Pressure and weight',
        questions: [
          {
            text: 'Pressure gauge reading (bar)',
            helpText: 'Should read within the green band.',
            questionType: 'NUMERIC',
            isMandatory: true,
            isSafetyCritical: true,
            requiresCorrectiveActionOnFail: true,
            numericMin: 12,
            numericMax: 18,
            numericUnit: 'bar',
          },
          {
            text: 'Gross weight (kg)',
            questionType: 'NUMERIC',
            isMandatory: false,
            numericUnit: 'kg',
          },
        ],
      },
      {
        title: 'Attachments',
        questions: [
          {
            text: 'Photo of the extinguisher',
            questionType: 'PHOTO',
            isMandatory: false,
          },
          {
            text: 'Remarks',
            questionType: 'REMARKS',
            isMandatory: false,
          },
        ],
      },
    ],
  },
  {
    name: 'Monthly Hydrant Check',
    description: 'Hydrant visual and functional check.',
    equipmentTypeKey: 'HYDRANT',
    frequencyDays: 30,
    sections: [
      {
        title: 'Visual',
        questions: [
          {
            text: 'Is the hydrant point accessible and unobstructed?',
            questionType: 'YES_NO',
            isMandatory: true,
            isSafetyCritical: true,
            requiresCorrectiveActionOnFail: true,
          },
          {
            text: 'Is the outlet cap in place?',
            questionType: 'YES_NO',
            isMandatory: true,
          },
          {
            text: 'Any visible leakage or corrosion?',
            questionType: 'DROPDOWN',
            options: ['None', 'Minor', 'Major'],
            isMandatory: true,
            requiresCorrectiveActionOnFail: true,
          },
        ],
      },
      {
        title: 'Functional',
        questions: [
          {
            text: 'Valve operates smoothly',
            questionType: 'PASS_FAIL',
            isMandatory: true,
            isSafetyCritical: true,
            requiresCorrectiveActionOnFail: true,
          },
          {
            text: 'Static pressure (bar)',
            questionType: 'NUMERIC',
            isMandatory: true,
            numericMin: 4,
            numericMax: 10,
            numericUnit: 'bar',
          },
        ],
      },
    ],
  },
  {
    name: 'Monthly Hose Reel Check',
    description: 'Fixed hose reel monthly inspection.',
    equipmentTypeKey: 'HOSE_REEL',
    frequencyDays: 30,
    sections: [
      {
        title: 'Reel and hose',
        questions: [
          {
            text: 'Reel is free to rotate',
            questionType: 'PASS_FAIL',
            isMandatory: true,
            isSafetyCritical: true,
            requiresCorrectiveActionOnFail: true,
          },
          {
            text: 'Hose is free of cracks or perishing',
            questionType: 'PASS_FAIL',
            isMandatory: true,
            requiresCorrectiveActionOnFail: true,
          },
          {
            text: 'Nozzle is attached and undamaged',
            questionType: 'YES_NO',
            isMandatory: true,
            requiresCorrectiveActionOnFail: true,
          },
        ],
      },
      {
        title: 'Attachments',
        questions: [
          {
            text: 'Remarks',
            questionType: 'REMARKS',
            isMandatory: false,
          },
        ],
      },
    ],
  },
  {
    name: 'Monthly Fire Pump Check',
    description: 'Pump room inspection and test-run.',
    equipmentTypeKey: 'FIRE_PUMP',
    frequencyDays: 30,
    sections: [
      {
        title: 'Pump room',
        questions: [
          {
            text: 'Pump room is clean, lit, and unobstructed',
            questionType: 'PASS_FAIL',
            isMandatory: true,
          },
          {
            text: 'Fuel level (for diesel pumps)',
            questionType: 'DROPDOWN',
            options: ['Full', 'Above ¾', 'Above ½', 'Low', 'Empty', 'N/A'],
            isMandatory: true,
            requiresCorrectiveActionOnFail: true,
          },
        ],
      },
      {
        title: 'Test run',
        questions: [
          {
            text: 'Pump started successfully',
            questionType: 'YES_NO',
            isMandatory: true,
            isSafetyCritical: true,
            requiresCorrectiveActionOnFail: true,
          },
          {
            text: 'Discharge pressure (bar)',
            questionType: 'NUMERIC',
            isMandatory: true,
            numericUnit: 'bar',
          },
          {
            text: 'Test run duration (minutes)',
            questionType: 'NUMERIC',
            isMandatory: true,
            numericMin: 5,
            numericMax: 30,
            numericUnit: 'min',
          },
          {
            text: 'Any unusual noise or vibration?',
            questionType: 'YES_NO',
            isMandatory: true,
            requiresCorrectiveActionOnFail: true,
          },
        ],
      },
    ],
  },
  {
    name: 'Monthly Smoke Detector Check',
    description: 'Visual inspection and functional test using a test aerosol.',
    equipmentTypeKey: 'SMOKE_DETECTOR',
    frequencyDays: 30,
    sections: [
      {
        title: 'Visual',
        questions: [
          {
            text: 'Detector is mounted securely',
            questionType: 'PASS_FAIL',
            isMandatory: true,
          },
          {
            text: 'Indicator LED is functioning',
            questionType: 'PASS_FAIL',
            isMandatory: true,
            requiresCorrectiveActionOnFail: true,
          },
        ],
      },
      {
        title: 'Functional test',
        questions: [
          {
            text: 'Detector alarms when tested with test aerosol',
            questionType: 'YES_NO',
            isMandatory: true,
            isSafetyCritical: true,
            requiresCorrectiveActionOnFail: true,
          },
          {
            text: 'Photo (optional)',
            questionType: 'PHOTO',
            isMandatory: false,
          },
        ],
      },
    ],
  },
];

async function upsertChecklistTemplates(
  typeIds: Record<string, string>,
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const spec of CHECKLIST_TEMPLATES) {
    const equipmentTypeId = typeIds[spec.equipmentTypeKey];
    if (!equipmentTypeId) continue;

    const existing = await prisma.checklistTemplate.findFirst({
      where: { name: spec.name, equipmentTypeId },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    // Create the template + draft v1 + populate content + publish.
    await prisma.$transaction(async (tx) => {
      const template = await tx.checklistTemplate.create({
        data: {
          name: spec.name,
          description: spec.description,
          equipmentTypeId,
          frequencyDays: spec.frequencyDays,
        },
      });

      const version = await tx.checklistTemplateVersion.create({
        data: {
          templateId: template.id,
          versionNumber: 1,
          status: 'DRAFT',
        },
      });

      let secSeq = 1;
      for (const section of spec.sections) {
        const createdSection = await tx.checklistSection.create({
          data: {
            versionId: version.id,
            title: section.title,
            description: section.description ?? null,
            sequence: secSeq++,
          },
        });
        let qSeq = 1;
        for (const q of section.questions) {
          await tx.checklistQuestion.create({
            data: {
              sectionId: createdSection.id,
              text: q.text,
              helpText: q.helpText ?? null,
              questionType: q.questionType,
              isMandatory: q.isMandatory,
              isSafetyCritical: q.isSafetyCritical ?? false,
              requiresCorrectiveActionOnFail:
                q.requiresCorrectiveActionOnFail ?? false,
              optionsJson:
                q.questionType === 'DROPDOWN' && q.options?.length
                  ? JSON.stringify(q.options)
                  : null,
              numericMin: q.numericMin ?? null,
              numericMax: q.numericMax ?? null,
              numericUnit: q.numericUnit ?? null,
              sequence: qSeq++,
            },
          });
        }
      }

      // Publish the initial version so it is immediately usable.
      await tx.checklistTemplateVersion.update({
        where: { id: version.id },
        data: {
          status: 'PUBLISHED',
          isCurrent: true,
          publishedAt: new Date(),
        },
      });
    });

    created++;
  }

  return { created, skipped };
}

async function main() {
  console.log('[seed] permissions…');
  await upsertPermissions();

  console.log('[seed] roles + role-permission mapping…');
  await upsertRolesAndPermissions();

  console.log('[seed] units + departments…');
  const units = await upsertUnits();

  console.log('[seed] demo users…');
  await upsertUsers(units);

  console.log('[seed] equipment types…');
  const typeIds = await upsertEquipmentTypes();

  console.log('[seed] sample equipment…');
  const equipmentStats = await upsertSampleEquipment(units, typeIds);
  console.log(
    `[seed] equipment: created=${equipmentStats.created} skipped=${equipmentStats.skipped}`,
  );

  console.log('[seed] checklist templates…');
  const checklistStats = await upsertChecklistTemplates(typeIds);
  console.log(
    `[seed] checklists: created=${checklistStats.created} skipped=${checklistStats.skipped}`,
  );

  const stats = {
    roles: await prisma.role.count(),
    permissions: await prisma.permission.count(),
    units: await prisma.unit.count(),
    departments: await prisma.department.count(),
    users: await prisma.user.count(),
    equipmentTypes: await prisma.equipmentType.count(),
    equipment: await prisma.equipment.count(),
    checklistTemplates: await prisma.checklistTemplate.count(),
    checklistVersions: await prisma.checklistTemplateVersion.count(),
    checklistSections: await prisma.checklistSection.count(),
    checklistQuestions: await prisma.checklistQuestion.count(),
  };
  console.log('[seed] complete', stats);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
