import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding 3NF Normalized Database...');

  // 1. Seed Case Statuses
  const statuses = [
    { code: 'Draft', nameAr: 'مسودة', nameEn: 'Draft', description: 'حالة مسودة غير مرسلة' },
    { code: 'Submitted', nameAr: 'تم التقديم', nameEn: 'Submitted', description: 'تم التقديم وبانتظار المراجعة' },
    { code: 'Under Review', nameAr: 'قيد المراجعة', nameEn: 'Under Review', description: 'قيد المراجعة الفنية من المعمل' },
    { code: 'Quoted', nameAr: 'تم التسعير', nameEn: 'Quoted', description: 'تم إرسال عرض السعر وبانتظار موافقة الطبيب' },
    { code: 'Approved', nameAr: 'معتمد', nameEn: 'Approved', description: 'تم اعتماد السعر من الطبيب' },
    { code: 'In Production', nameAr: 'في التصنيع', nameEn: 'In Production', description: 'الحالة قيد التصنيع الفني' },
    { code: 'Quality Control', nameAr: 'فحص الجودة', nameEn: 'Quality Control', description: 'الحالة في مرحلة فحص الجودة' },
    { code: 'Ready', nameAr: 'جاهز للتسليم', nameEn: 'Ready', description: 'الحالة جاهزة للتوصيل للعيادة' },
    { code: 'Delivered', nameAr: 'تم التسليم', nameEn: 'Delivered', description: 'تم تسليم الحالة وتفعيل الضمان' },
    { code: 'Closed', nameAr: 'مغلق', nameEn: 'Closed', description: 'تم إغلاق الحالة وأرشفتها' },
    { code: 'Rework', nameAr: 'إعادة عمل', nameEn: 'Rework', description: 'طلب تعديل أو إعادة تصنيع' },
    { code: 'Cancelled', nameAr: 'ملغى', nameEn: 'Cancelled', description: 'تم إلغاء الطلب' }
  ];

  const dbStatuses: Record<string, any> = {};
  for (const s of statuses) {
    dbStatuses[s.code] = await prisma.caseStatus.upsert({
      where: { code: s.code },
      update: {},
      create: s
    });
  }
  console.log('Case statuses seeded.');

  // 2. Seed Priorities
  const priorities = [
    { code: 'Low', nameAr: 'منخفضة', nameEn: 'Low' },
    { code: 'Medium', nameAr: 'متوسطة', nameEn: 'Medium' },
    { code: 'High', nameAr: 'عالية', nameEn: 'High' },
    { code: 'Urgent', nameAr: 'عاجلة جداً', nameEn: 'Urgent' }
  ];

  const dbPriorities: Record<string, any> = {};
  for (const p of priorities) {
    dbPriorities[p.code] = await prisma.priority.upsert({
      where: { code: p.code },
      update: {},
      create: p
    });
  }
  console.log('Priorities seeded.');

  // 3. Seed Materials
  const materials = [
    { code: 'ZIRCONIA_ML', nameAr: 'زركونيا متعدد الطبقات', nameEn: 'Zirconia Multi-Layer', category: 'Zirconia', basePricePerUnit: 800.00 },
    { code: 'ZIRCONIA_UT', nameAr: 'زركونيا فائق الشفافية', nameEn: 'Zirconia Ultra-Translucent', category: 'Zirconia', basePricePerUnit: 1000.00 },
    { code: 'EMAX_PRESS', nameAr: 'إيماكس مضغوط', nameEn: 'Emax Press', category: 'Ceramic', basePricePerUnit: 700.00 },
    { code: 'TITANIUM_ABUT', nameAr: 'دعامة تيتانيوم مخصصة', nameEn: 'Titanium Custom Abutment', category: 'Metal', basePricePerUnit: 1200.00 },
    { code: 'PMMA_TEMP', nameAr: 'مؤقت أكريليك PMMA', nameEn: 'Temporary PMMA', category: 'PMMA', basePricePerUnit: 300.00 }
  ];

  const dbMaterials: Record<string, any> = {};
  for (const m of materials) {
    dbMaterials[m.code] = await prisma.material.upsert({
      where: { code: m.code },
      update: {},
      create: m
    });
  }
  console.log('Materials seeded.');

  // 4. Seed Shades
  const shades = [
    { code: 'A1', name: 'A1', category: 'VITA Classical' },
    { code: 'A2', name: 'A2', category: 'VITA Classical' },
    { code: 'A3', name: 'A3', category: 'VITA Classical' },
    { code: 'A3.5', name: 'A3.5', category: 'VITA Classical' },
    { code: 'B1', name: 'B1', category: 'VITA Classical' },
    { code: 'B2', name: 'B2', category: 'VITA Classical' },
    { code: 'C1', name: 'C1', category: 'VITA Classical' },
    { code: 'Bleach', name: 'Bleach OM1', category: 'Bleach' }
  ];

  const dbShades: Record<string, any> = {};
  for (const s of shades) {
    dbShades[s.code] = await prisma.shade.upsert({
      where: { code: s.code },
      update: {},
      create: s
    });
  }
  console.log('Color shades seeded.');

  // 5. Seed Production Stage Types
  const stageTypes = [
    { code: 'SCANNING', nameAr: 'مسح رقمي ثلاثي الأبعاد', nameEn: '3D Scanning', sequenceOrder: 1 },
    { code: 'CAD_DESIGN', nameAr: 'تصميم رقمي CAD', nameEn: 'CAD Designing', sequenceOrder: 2 },
    { code: 'SINTERING', nameAr: 'فرط وتلبيد الفرن', nameEn: 'Milling & Sintering', sequenceOrder: 3 },
    { code: 'CERAMIC', nameAr: 'بناء الخزف والسيراميك', nameEn: 'Ceramic Layering', sequenceOrder: 4 },
    { code: 'FINISHING', nameAr: 'تلميع وتشطيب نهائي', nameEn: 'Glazing & Finishing', sequenceOrder: 5 }
  ];

  const dbStageTypes: Record<string, any> = {};
  for (const st of stageTypes) {
    dbStageTypes[st.code] = await prisma.productionStageType.upsert({
      where: { code: st.code },
      update: {},
      create: st
    });
  }
  console.log('Production stage types seeded.');

  // 6. Seed Payment Methods & Statuses
  const paymentMethods = [
    { code: 'CASH', nameAr: 'نقداً', nameEn: 'Cash' },
    { code: 'BANK_TRANSFER', nameAr: 'تحويل بنكي', nameEn: 'Bank Transfer' },
    { code: 'INSTAPAY', nameAr: 'إنستاباي', nameEn: 'Instapay' }
  ];
  const dbPaymentMethods: Record<string, any> = {};
  for (const pm of paymentMethods) {
    dbPaymentMethods[pm.code] = await prisma.paymentMethod.upsert({
      where: { code: pm.code },
      update: {},
      create: pm
    });
  }

  const paymentStatuses = [
    { code: 'PENDING', nameAr: 'قيد المراجعة', nameEn: 'Pending' },
    { code: 'CONFIRMED', nameAr: 'تم التأكيد', nameEn: 'Confirmed' },
    { code: 'FAILED', nameAr: 'فشل التأكيد', nameEn: 'Failed' }
  ];
  const dbPaymentStatuses: Record<string, any> = {};
  for (const ps of paymentStatuses) {
    dbPaymentStatuses[ps.code] = await prisma.paymentStatus.upsert({
      where: { code: ps.code },
      update: {},
      create: ps
    });
  }
  console.log('Payments metadata seeded.');

  // 7. Seed Permissions
  const permissionsList = [
    { name: 'Create Case', permissionKey: 'cases:create', description: 'إنشاء مسودة حالة' },
    { name: 'Submit Case', permissionKey: 'cases:submit', description: 'إرسال حالة للمعمل' },
    { name: 'View Own Cases', permissionKey: 'cases:read:own', description: 'مشاهدة حالات العيادة فقط' },
    { name: 'View All Cases', permissionKey: 'cases:read:all', description: 'مشاهدة كل حالات المعمل' },
    { name: 'Delete Case', permissionKey: 'cases:delete', description: 'حذف مسودة حالة' },
    { name: 'Upload Files', permissionKey: 'files:upload', description: 'رفع ملفات STL/صور' },
    { name: 'Create Quotation', permissionKey: 'quotes:create', description: 'إنشاء عرض سعر للحالة' },
    { name: 'Approve Quotation', permissionKey: 'quotes:validate', description: 'اعتماد عرض السعر' },
    { name: 'Log Payment', permissionKey: 'payments:create', description: 'إدخال دفعة مالية' },
    { name: 'Confirm Payment', permissionKey: 'payments:confirm', description: 'تأكيد استلام الدفعة مالياً' },
    { name: 'Assign Technician', permissionKey: 'production:assign', description: 'تعيين فني للمرحلة' },
    { name: 'Update Stage', permissionKey: 'production:update', description: 'تحديث مرحلة العمل' },
    { name: 'Record QC Score', permissionKey: 'production:qc', description: 'تقييم جودة المنتج' },
    { name: 'Deliver Packages', permissionKey: 'logistics:deliver', description: 'توصيل الحالات للعيادات' }
  ];

  const dbPermissions: Record<string, any> = {};
  for (const perm of permissionsList) {
    dbPermissions[perm.permissionKey] = await prisma.permission.upsert({
      where: { permissionKey: perm.permissionKey },
      update: {},
      create: perm
    });
  }
  console.log('Permissions catalog seeded.');

  // 8. Seed Roles & Mappings
  const rolePermissionsMapping: Record<string, string[]> = {
    'Doctor': ['cases:create', 'cases:submit', 'cases:read:own', 'files:upload', 'quotes:validate', 'payments:create'],
    'Clinic Assistant': ['cases:create', 'cases:submit', 'cases:read:own', 'files:upload'],
    'Laboratory Admin': ['cases:read:all', 'files:upload', 'quotes:create', 'payments:confirm', 'production:assign', 'production:update', 'production:qc'],
    'Technician': ['cases:read:own', 'production:update'],
    'Delivery Coordinator': ['cases:read:own', 'logistics:deliver'],
    'Owner': ['cases:read:all', 'quotes:create', 'payments:confirm', 'production:assign', 'production:update', 'production:qc']
  };

  const dbRoles: Record<string, any> = {};
  for (const roleName of Object.keys(rolePermissionsMapping)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName }
    });
    dbRoles[roleName] = role;

    // Clear previous mappings
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    // Insert new mappings
    const mappings = rolePermissionsMapping[roleName].map(key => ({
      roleId: role.id,
      permissionId: dbPermissions[key].id
    }));
    await prisma.rolePermission.createMany({ data: mappings });
  }
  console.log('Roles and permission mappings seeded.');

  // Hash Password
  const passwordHash = await bcrypt.hash('EDLpassword2026', 10);

  // 9. Seed Users & Profiles
  // Doctor
  const doctorUser = await prisma.user.upsert({
    where: { phone: '+201011111111' },
    update: {},
    create: {
      phone: '+201011111111',
      email: 'doctor@edl.com',
      fullName: 'د. محمد أسيوط',
      passwordHash,
      roleId: dbRoles['Doctor'].id
    }
  });

  const doctorProfile = await prisma.doctor.upsert({
    where: { userId: doctorUser.id },
    update: {},
    create: {
      userId: doctorUser.id,
      specialization: 'Cosmetic Dentistry'
    }
  });

  // Assistant
  const assistantUser = await prisma.user.upsert({
    where: { phone: '+201022222222' },
    update: {},
    create: {
      phone: '+201022222222',
      email: 'assistant@edl.com',
      fullName: 'أ. أسماء عياد',
      passwordHash,
      roleId: dbRoles['Clinic Assistant'].id
    }
  });

  // Lab Admin
  const adminUser = await prisma.user.upsert({
    where: { phone: '+201033333333' },
    update: {},
    create: {
      phone: '+201033333333',
      email: 'admin@edl.com',
      fullName: 'أ. حسام مشرف المعمل',
      passwordHash,
      roleId: dbRoles['Laboratory Admin'].id
    }
  });

  // Tech
  const techUser = await prisma.user.upsert({
    where: { phone: '+201044444444' },
    update: {},
    create: {
      phone: '+201044444444',
      email: 'tech@edl.com',
      fullName: 'فني. محمود صبحي',
      passwordHash,
      roleId: dbRoles['Technician'].id
    }
  });

  const techProfile = await prisma.technician.upsert({
    where: { userId: techUser.id },
    update: {},
    create: {
      userId: techUser.id,
      specialty: 'CAD/CAM & Ceramic Artistry',
      currentWorkload: 1
    }
  });

  // Courier
  const courierUser = await prisma.user.upsert({
    where: { phone: '+201055555555' },
    update: {},
    create: {
      phone: '+201055555555',
      fullName: 'كابتن. علي التوصيل',
      passwordHash,
      roleId: dbRoles['Delivery Coordinator'].id
    }
  });
  console.log('Identity nodes and profiles seeded.');

  // 10. Seed Clinics
  const clinic = await prisma.clinic.create({
    data: {
      doctorId: doctorProfile.id,
      name: 'عيادة أسيوط الحديثة لطب الأسنان',
      address: 'شارع الجمهورية، أمام عمر أفندي، أسيوط',
      city: 'Assiut',
      phone: '+20882345678'
    }
  });

  // 11. Seed Case Transactions (Draft, Submitted, In Production)
  const caseDraft = await prisma.case.create({
    data: {
      caseNumber: 'EDL-2026-00001',
      doctorId: doctorProfile.id,
      clinicId: clinic.id,
      patientReference: 'أحمد علي',
      toothSelection: [11, 21],
      shadeId: dbShades['A2'].id,
      materialId: dbMaterials['ZIRCONIA_ML'].id,
      priorityId: dbPriorities['Medium'].id,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      statusId: dbStatuses['Draft'].id
    }
  });

  const caseSubmitted = await prisma.case.create({
    data: {
      caseNumber: 'EDL-2026-00002',
      doctorId: doctorProfile.id,
      clinicId: clinic.id,
      patientReference: 'مريم محمود',
      toothSelection: [36, 37],
      shadeId: dbShades['A3'].id,
      materialId: dbMaterials['EMAX_PRESS'].id,
      priorityId: dbPriorities['High'].id,
      dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      statusId: dbStatuses['Submitted'].id
    }
  });

  const caseProduction = await prisma.case.create({
    data: {
      caseNumber: 'EDL-2026-00003',
      doctorId: doctorProfile.id,
      clinicId: clinic.id,
      patientReference: 'داليا حسن',
      toothSelection: [13, 12, 11, 21, 22, 23],
      shadeId: dbShades['Bleach'].id,
      materialId: dbMaterials['ZIRCONIA_UT'].id,
      priorityId: dbPriorities['Urgent'].id,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      statusId: dbStatuses['In Production'].id
    }
  });

  // Files & Timeline for caseProduction
  await prisma.caseFile.create({
    data: {
      caseId: caseProduction.id,
      fileName: 'upper_jaw_scan.stl',
      fileType: 'STL',
      fileUrl: 'https://storage.edl.com/scans/upper_jaw_scan_1092.stl',
      fileSize: 18239402,
      uploadedBy: doctorUser.id
    }
  });

  await prisma.caseTimeline.create({
    data: {
      caseId: caseProduction.id,
      statusFromId: dbStatuses['Submitted'].id,
      statusToId: dbStatuses['In Production'].id,
      changedBy: adminUser.id,
      notes: 'تم اعتماد عرض السعر والبدء بالتصنيع.'
    }
  });

  // Production Stage
  await prisma.productionStage.create({
    data: {
      caseId: caseProduction.id,
      technicianId: techProfile.id,
      stageTypeId: dbStageTypes['CAD_DESIGN'].id,
      status: 'In Progress',
      startedAt: new Date()
    }
  });

  console.log('Case cycles and log histories seeded.');
  console.log('Seeding 3NF complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
