
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Roles
CREATE TYPE public.app_role AS ENUM ('sys_admin','helpdesk','supervisor','field_tech','warehouse');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'sys_admin')) WITH CHECK (public.has_role(auth.uid(),'sys_admin'));

-- Tickets
CREATE TYPE public.ticket_priority AS ENUM ('P1','P2','P3');
CREATE TYPE public.ticket_status AS ENUM ('Open','In Progress','Pending','Resolved','Closed','Rejected');
CREATE TYPE public.ticket_category AS ENUM ('ASDP VMS','INTANK');

CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  customer TEXT NOT NULL,
  company TEXT NOT NULL,
  phone TEXT NOT NULL,
  category public.ticket_category NOT NULL,
  location TEXT NOT NULL,
  equipment TEXT NOT NULL,
  serial TEXT,
  description TEXT NOT NULL,
  priority public.ticket_priority NOT NULL DEFAULT 'P3',
  status public.ticket_status NOT NULL DEFAULT 'Open',
  assignee TEXT,
  sla_deadline TIMESTAMPTZ,
  sla_paused BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.tickets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit tickets" ON public.tickets FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can view tickets by code" ON public.tickets FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated view all tickets" ON public.tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can update tickets" ON public.tickets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'helpdesk') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'sys_admin') OR public.has_role(auth.uid(),'field_tech'));
CREATE POLICY "Admins delete tickets" ON public.tickets FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'sys_admin'));

-- Inventory
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  quarantine INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pcs',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO authenticated;
GRANT ALL ON public.inventory TO service_role;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view inventory" ON public.inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Warehouse manages inventory" ON public.inventory FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'warehouse') OR public.has_role(auth.uid(),'sys_admin'))
  WITH CHECK (public.has_role(auth.uid(),'warehouse') OR public.has_role(auth.uid(),'sys_admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed inventory
INSERT INTO public.inventory (sku,name,category,stock,min_stock,quarantine,unit) VALUES
 ('CBL-UTP-30','Kabel UTP Cat6 30m','Kabel',42,15,3,'roll'),
 ('PSU-12V-5A','Power Supply 12V 5A','Power',8,10,2,'pcs'),
 ('CAM-IP-4MP','IP Camera 4MP Dome','Kamera',12,5,1,'pcs'),
 ('SNS-ULT-14','Ultrasonic Sensor U-14','Sensor',3,6,4,'pcs'),
 ('RTR-4G-LTE','Router 4G LTE Industrial','Network',15,4,0,'pcs'),
 ('FLM-FM08','Flow Meter FM-08','Sensor',5,3,2,'pcs'),
 ('SCR-SET-01','Toolkit Screwdriver Set','Tool',20,8,0,'set');

-- Seed tickets
INSERT INTO public.tickets (code,customer,company,phone,category,location,equipment,serial,description,priority,status,assignee,sla_deadline,sla_paused,created_at) VALUES
 ('TKT-2026-0812','Budi Santoso','ASDP Merak','+62 812 3345 1290','ASDP VMS','Merak','VMS Display Panel A2','VMS-A2-0091','Panel mati total sejak jam 3 pagi. Kapal antrian tidak bisa dipantau.','P1','In Progress','Kevin','2026-07-20T03:12:00Z',false,'2026-07-17T03:12:00Z'),
 ('TKT-2026-0813','Sri Mulyani','PAMA Site A','+62 821 4455 6677','INTANK','PAMA Site A','Flow Meter FM-08',NULL,'Reading tidak akurat, selisih 12% dari manual gauging.','P2','Open',NULL,'2026-07-18T07:45:00Z',false,'2026-07-17T07:45:00Z'),
 ('TKT-2026-0814','Anwar Fuadi','ASDP Bakauheni','+62 813 9988 7766','ASDP VMS','Bakauheni','Camera CCTV Dock 3',NULL,'Feed CCTV terputus intermittent.','P1','Pending','Hilman','2026-07-19T22:10:00Z',true,'2026-07-16T22:10:00Z');
