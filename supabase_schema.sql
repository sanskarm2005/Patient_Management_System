-- SUPABASE DATABASE INITIALIZATION SCHEMA
-- Medical Clinic Queue & Staff Management System

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles Table (staff/doctor accounts)
create table public.profiles (
  id uuid default gen_random_uuid() primary key,
  full_name text not null,
  role text not null check (role in ('receptionist', 'doctor', 'admin')),
  specialty text,
  room_number text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Profiles
alter table public.profiles enable row level security;

create policy "Allow profile read for authenticated users" 
  on public.profiles for select 
  using (auth.role() = 'authenticated');

create policy "Allow profile updates for owners or receptionists" 
  on public.profiles for update 
  using (auth.uid() = id or (select role from public.profiles where id = auth.uid()) = 'receptionist');

-- 2. Patients Table (permanent records)
create table public.patients (
  id uuid default gen_random_uuid() primary key,
  patient_id text unique not null,
  full_name text not null,
  phone_number text not null,
  date_of_birth date,
  gender text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  allergies text,
  medical_history text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Patients
alter table public.patients enable row level security;

create policy "Allow all patient operations for authenticated users" 
  on public.patients for all 
  using (auth.role() = 'authenticated');

-- 3. Appointments Table (bookings)
create table public.appointments (
  id uuid default gen_random_uuid() primary key,
  patient_id uuid references public.patients(id) on delete cascade not null,
  doctor_id uuid references public.profiles(id) on delete cascade not null,
  appointment_date date not null,
  appointment_time time without time zone not null,
  reason text,
  status text not null default 'scheduled' check (status in ('scheduled', 'checked_in', 'completed', 'cancelled', 'no_show')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Appointments
alter table public.appointments enable row level security;

create policy "Allow appointment read for authenticated users" 
  on public.appointments for select 
  using (auth.role() = 'authenticated');

create policy "Allow appointment write for receptionists" 
  on public.appointments for insert 
  with check ((select role from public.profiles where id = auth.uid()) = 'receptionist');

create policy "Allow appointment updates for receptionists" 
  on public.appointments for update 
  using ((select role from public.profiles where id = auth.uid()) = 'receptionist');

-- 4. Queue Entries Table (daily waiting queue)
create table public.queue_entries (
  id uuid default gen_random_uuid() primary key,
  token_number integer not null,
  patient_id uuid references public.patients(id) on delete cascade not null,
  doctor_id uuid references public.profiles(id) on delete cascade not null,
  appointment_id uuid references public.appointments(id) on delete set null,
  visit_type text not null check (visit_type in ('walk-in', 'appointment')),
  status text not null default 'waiting' check (status in ('waiting', 'called', 'in_consultation', 'completed', 'no_show', 'cancelled')),
  arrival_time timestamp with time zone default timezone('utc'::text, now()) not null,
  called_time timestamp with time zone,
  called_by uuid references public.profiles(id),
  consultation_start_time timestamp with time zone,
  consultation_end_time timestamp with time zone,
  queue_date date not null default current_date
);

-- Enable RLS for Queue Entries
alter table public.queue_entries enable row level security;

create policy "Allow public read for active queue" 
  on public.queue_entries for select 
  using (true); -- Publicly viewable for Waiting Room Display TV

create policy "Allow queue management for authenticated users" 
  on public.queue_entries for all 
  using (auth.role() = 'authenticated');

-- 5. Consultations Table (clinical medical files)
create table public.consultations (
  id uuid default gen_random_uuid() primary key,
  queue_entry_id uuid references public.queue_entries(id) on delete cascade not null,
  patient_id uuid references public.patients(id) on delete cascade not null,
  doctor_id uuid references public.profiles(id) on delete cascade not null,
  chief_complaint text not null,
  notes text,
  diagnosis text,
  prescription text,
  follow_up_notes text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- Enable RLS for Consultations (restricted to doctors only)
alter table public.consultations enable row level security;

create policy "Allow consultations read and write for doctors" 
  on public.consultations for all 
  using ((select role from public.profiles where id = auth.uid()) = 'doctor');

-- 6. Notifications Table (in-app messages)
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade, -- Null means broadcast to everyone
  title text not null,
  message text not null,
  type text not null,
  is_read boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.notifications enable row level security;

create policy "Allow select notifications for all authenticated users" 
  on public.notifications for select 
  using (auth.role() = 'authenticated');

create policy "Allow write notifications for authenticated users" 
  on public.notifications for insert 
  with check (auth.role() = 'authenticated');

create policy "Allow notification update for owners" 
  on public.notifications for update 
  using (auth.role() = 'authenticated');

-- 7. Audit Logs Table (immutable logs)
create table public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.audit_logs enable row level security;

create policy "Allow select audit logs for receptionists" 
  on public.audit_logs for select 
  using ((select role from public.profiles where id = auth.uid()) = 'receptionist');

create policy "Allow insertion of audit logs for all authenticated users" 
  on public.audit_logs for insert 
  with check (auth.role() = 'authenticated');

-- 8. Clinic Settings Table
create table public.clinic_settings (
  id uuid default gen_random_uuid() primary key,
  clinic_name text not null default 'MedClinic',
  avg_consultation_duration integer not null default 10
);

alter table public.clinic_settings enable row level security;

create policy "Allow public read of clinic settings" 
  on public.clinic_settings for select 
  using (true);

create policy "Allow update of clinic settings for receptionists" 
  on public.clinic_settings for update 
  using ((select role from public.profiles where id = auth.uid()) = 'receptionist');

-- --- SEED DATA ---
insert into public.clinic_settings (id, clinic_name, avg_consultation_duration) 
values ('c0000000-0000-0000-0000-000000000001', 'MedClinic Specialists', 10);

insert into public.profiles (id, full_name, role, specialty, room_number, status)
values ('11111111-1111-1111-1111-111111111111', 'Dr. Sarah Johnson', 'doctor', 'General Physician', 'Room 1', 'active')
on conflict (id) do nothing;

-- Fix foreign key constraints for authentication/profiles if needed
alter table public.queue_entries drop constraint if exists queue_entries_called_by_fkey;

-- Enable Realtime Replication for queue_entries in Supabase
alter publication supabase_realtime add table public.queue_entries;

