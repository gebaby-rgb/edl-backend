import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';

const prisma = new PrismaClient();

// Helper to generate a sequential Case Number: EDL-2026-00001
async function generateCaseNumber() {
  const currentYear = new Date().getFullYear();
  const prefix = `EDL-${currentYear}-`;
  
  // Count existing cases of current year
  const count = await prisma.case.count({
    where: {
      caseNumber: {
        startsWith: prefix
      }
    }
  });

  const nextSequence = (count + 1).toString().padStart(5, '0');
  return `${prefix}${nextSequence}`;
}

export async function createCase(req: AuthenticatedRequest, res: Response) {
  const { clinic_id, patient_reference, tooth_selection, shade_selection, material_selection, priority, due_date, file_urls } = req.body;

  if (!patient_reference || !tooth_selection || !shade_selection || !material_selection || !due_date) {
    return res.status(400).json({ error: 'Missing required case fields' });
  }

  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Validate Doctor association
    let doctorId: string;
    if (userRole === 'Doctor') {
      const doctor = await prisma.doctor.findUnique({ where: { userId } });
      if (!doctor) return res.status(400).json({ error: 'Doctor profile not found' });
      doctorId = doctor.id;
    } else if (userRole === 'Clinic Assistant') {
      // Find doctor associated with assistant
      const assistantUser = await prisma.user.findUnique({ where: { id: userId } });
      // For mock purposes, get first doctor in the DB or associate assistant's clinics
      const firstDoctor = await prisma.doctor.findFirst();
      if (!firstDoctor) return res.status(400).json({ error: 'No Doctor registered in system' });
      doctorId = firstDoctor.id;
    } else {
      return res.status(403).json({ error: 'Only Doctors or Assistants can create cases' });
    }

    // Default clinic if not provided
    let finalClinicId = clinic_id;
    if (!finalClinicId) {
      const clinic = await prisma.clinic.findFirst({ where: { doctorId } });
      if (!clinic) return res.status(400).json({ error: 'No clinic found for this doctor' });
      finalClinicId = clinic.id;
    }

    const caseNumber = await generateCaseNumber();

    const newCase = await prisma.case.create({
      data: {
        caseNumber,
        doctorId,
        clinicId: finalClinicId,
        patientReference: patient_reference,
        toothSelection: toothSelection,
        shadeSelection: shade_selection,
        materialSelection: material_selection,
        priority: priority || 'Medium',
        dueDate: new Date(due_date),
        status: 'Submitted'
      }
    });

    // Handle files if uploaded
    if (file_urls && Array.isArray(file_urls)) {
      for (const url of file_urls) {
        await prisma.caseFile.create({
          data: {
            caseId: newCase.id,
            fileName: url.substring(url.lastIndexOf('/') + 1),
            fileType: url.endsWith('.stl') ? 'STL' : 'Image',
            fileUrl: url,
            fileSize: 1024 * 1024 * 10, // Mock 10MB
            uploadedBy: userId
          }
        });
      }
    }

    // Add Timeline
    await prisma.caseTimeline.create({
      data: {
        caseId: newCase.id,
        statusFrom: 'Draft',
        statusTo: 'Submitted',
        changedBy: userId,
        notes: 'تم تقديم الحالة بنجاح.'
      }
    });

    return res.status(201).json(newCase);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error during case creation' });
  }
}

export async function getCases(req: AuthenticatedRequest, res: Response) {
  const { status, search, page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    let whereClause: any = { deletedAt: null };

    // Role-based restrictions
    if (userRole === 'Doctor') {
      const doctor = await prisma.doctor.findUnique({ where: { userId } });
      if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
      whereClause.doctorId = doctor.id;
    } else if (userRole === 'Clinic Assistant') {
      // Find doctor clinics
      const doctor = await prisma.doctor.findFirst(); // Mock mapping helper
      if (doctor) whereClause.doctorId = doctor.id;
    } else if (userRole === 'Technician') {
      // Technicians only see cases assigned to them or in production
      const tech = await prisma.technician.findUnique({ where: { userId } });
      if (tech) {
        whereClause.productionStages = {
          some: { technicianId: tech.id }
        };
      }
    }

    // Filters
    if (status) {
      whereClause.status = status;
    }

    if (search) {
      whereClause.OR = [
        { caseNumber: { contains: String(search), mode: 'insensitive' } },
        { patientReference: { contains: String(search), mode: 'insensitive' } }
      ];
    }

    const cases = await prisma.case.findMany({
      where: whereClause,
      include: {
        doctor: { include: { user: true } },
        clinic: true,
        quotation: true,
        invoice: true
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    });

    const total = await prisma.case.count({ where: whereClause });

    return res.status(200).json({
      data: cases,
      pagination: {
        total,
        page: Number(page),
        total_pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error while fetching cases' });
  }
}

export async function getCaseById(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;

  try {
    const caseDetails = await prisma.case.findUnique({
      where: { id },
      include: {
        doctor: { include: { user: true } },
        clinic: true,
        files: true,
        timeline: { include: { user: true } },
        quotation: true,
        invoice: { include: { items: true, payments: true } },
        productionStages: { include: { technician: { include: { user: true } } } },
        deliveryOrder: { include: { courier: true } },
        warrantyCard: true
      }
    });

    if (!caseDetails) {
      return res.status(404).json({ error: 'Case not found' });
    }

    return res.status(200).json(caseDetails);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateCaseStatus(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { status, notes } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status field is required' });
  }

  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const existingCase = await prisma.case.findUnique({ where: { id } });
    if (!existingCase) return res.status(404).json({ error: 'Case not found' });

    // Block moving to production if quotation is not approved
    if (status === 'In Production') {
      const quote = await prisma.quotation.findUnique({ where: { caseId: id } });
      if (!quote || quote.status !== 'Approved') {
        return res.status(400).json({ error: 'Cannot move case to Production without approved quotation' });
      }
    }

    const updatedCase = await prisma.case.update({
      where: { id },
      data: { status }
    });

    // Add timeline record
    await prisma.caseTimeline.create({
      data: {
        caseId: id,
        statusFrom: existingCase.status,
        statusTo: status,
        changedBy: userId,
        notes: notes || `حالة الطلب تغيرت إلى: ${status}`
      }
    });

    // Auto-generate Warranty Card if Delivered
    if (status === 'Delivered') {
      const existingWarranty = await prisma.warrantyCard.findUnique({ where: { caseId: id } });
      if (!existingWarranty) {
        const warrantyNumber = `W-${Date.now()}-${existingCase.caseNumber}`;
        const issueDate = new Date();
        const expiryDate = new Date();
        expiryDate.setFullYear(issueDate.getFullYear() + 5); // Default 5 years

        await prisma.warrantyCard.create({
          data: {
            caseId: id,
            warrantyNumber,
            issueDate,
            expiryDate,
            status: 'Active'
          }
        });
      }
    }

    return res.status(200).json(updatedCase);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function assignTechnician(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { technician_id, stage_name } = req.body;

  if (!technician_id || !stage_name) {
    return res.status(400).json({ error: 'Technician ID and stage name are required' });
  }

  try {
    // Upsert a production stage
    const stage = await prisma.productionStage.create({
      data: {
        caseId: id,
        technicianId: technician_id,
        stageName: stage_name,
        status: 'In Progress',
        startedAt: new Date()
      }
    });

    // Increment technician workload
    await prisma.technician.update({
      where: { id: technician_id },
      data: { currentWorkload: { increment: 1 } }
    });

    return res.status(200).json(stage);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Error assigning technician' });
  }
}
