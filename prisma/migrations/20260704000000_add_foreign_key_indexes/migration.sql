-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "clinics_doctor_id_idx" ON "clinics"("doctor_id");

-- CreateIndex
CREATE INDEX "cases_doctor_id_idx" ON "cases"("doctor_id");
CREATE INDEX "cases_clinic_id_idx" ON "cases"("clinic_id");
CREATE INDEX "cases_shade_id_idx" ON "cases"("shade_id");
CREATE INDEX "cases_material_id_idx" ON "cases"("material_id");
CREATE INDEX "cases_priority_id_idx" ON "cases"("priority_id");
CREATE INDEX "cases_status_id_idx" ON "cases"("status_id");

-- CreateIndex
CREATE INDEX "case_files_case_id_idx" ON "case_files"("case_id");
CREATE INDEX "case_files_uploaded_by_idx" ON "case_files"("uploaded_by");

-- CreateIndex
CREATE INDEX "case_messages_case_id_idx" ON "case_messages"("case_id");
CREATE INDEX "case_messages_sender_id_idx" ON "case_messages"("sender_id");

-- CreateIndex
CREATE INDEX "attachments_message_id_idx" ON "attachments"("message_id");

-- CreateIndex
CREATE INDEX "case_timeline_case_id_idx" ON "case_timeline"("case_id");
CREATE INDEX "case_timeline_status_from_id_idx" ON "case_timeline"("status_from_id");
CREATE INDEX "case_timeline_status_to_id_idx" ON "case_timeline"("status_to_id");
CREATE INDEX "case_timeline_changed_by_idx" ON "case_timeline"("changed_by");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");
CREATE INDEX "payments_payment_method_id_idx" ON "payments"("payment_method_id");
CREATE INDEX "payments_status_id_idx" ON "payments"("status_id");
CREATE INDEX "payments_confirmed_by_idx" ON "payments"("confirmed_by");

-- CreateIndex
CREATE INDEX "production_stages_case_id_idx" ON "production_stages"("case_id");
CREATE INDEX "production_stages_technician_id_idx" ON "production_stages"("technician_id");
CREATE INDEX "production_stages_stage_type_id_idx" ON "production_stages"("stage_type_id");

-- CreateIndex
CREATE INDEX "delivery_orders_courier_id_idx" ON "delivery_orders"("courier_id");

-- CreateIndex
CREATE INDEX "templates_doctor_id_idx" ON "templates"("doctor_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "devices_user_id_idx" ON "devices"("user_id");
