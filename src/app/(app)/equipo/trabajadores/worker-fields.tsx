"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COST_CLASSIFICATIONS, CONTRACT_TYPES, DOC_TYPES, WORK_SCHEDULES, WORKER_TYPES } from "@/lib/rrhh/workers";

import { WorkerCategoryPicker } from "./category-picker";
import { PositionPicker } from "./position-picker";

// Mismo sentinel que lee src/actions/workers.ts (Radix no admite value="").
const NONE = "__none__";

export type WorkerValues = {
  full_name: string;
  doc_type: string;
  doc_number: string;
  position_id: string | null;
  hire_date: string | null;
  worker_type: string;
  end_date: string | null;
  hourly_rate: number;
  contract_type: string;
  salary: number;
  work_schedule: string;
  eps: string | null;
  pension_fund: string | null;
  arl_risk_class: number | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_phone: string | null;
  warehouse_id: string | null;
  category_id: string | null;
  cost_classification?: string | null;
  /** S21-03: acceso a Miel (solo lectura aquí; se cambia en "Acceso a Miel"). */
  username?: string | null;
  user_id?: string | null;
};

type Option = { id: string; name: string };

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function Choice({
  id,
  name,
  value,
  options,
  none,
}: {
  id: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  none?: string;
}) {
  return (
    <Select name={name} defaultValue={value || (none ? NONE : undefined)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {none ? <SelectItem value={NONE}>{none}</SelectItem> : null}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const toOptions = (o: Record<string, string>) => Object.entries(o).map(([value, label]) => ({ value, label }));

/** Área de RRHH: planta (Trabajadores) o temporales y por horas. */
export type WorkerArea = "planta" | "temporales";

/**
 * S21-02/S21-02c: ficha del trabajador, en bloques de a pares (identificación, trabajo, seguridad
 * social, contacto). En el área de temporales se elige Temporal (con fecha de término) o Por horas
 * (con valor hora en lugar de salario mensual).
 */
export function WorkerFields({
  idPrefix,
  area,
  values,
  categories,
  positions,
  warehouses,
}: {
  idPrefix: string;
  area: WorkerArea;
  values?: WorkerValues;
  categories: Option[];
  positions: Option[];
  warehouses: Option[];
}) {
  const id = (f: string) => `${idPrefix}-${f}`;
  const [workerType, setWorkerType] = useState(
    values?.worker_type ?? (area === "planta" ? "planta" : "temporal"),
  );
  const hourly = workerType === "por_horas";
  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <h3 className="text-sm font-medium text-muted-foreground sm:col-span-2">Identificación</h3>
        <div className="sm:col-span-2">
          <Field id={id("full_name")} label="Nombre completo">
            <Input id={id("full_name")} name="full_name" required maxLength={120} defaultValue={values?.full_name} />
          </Field>
        </div>
        <Field id={id("doc_type")} label="Tipo de documento">
          <Choice id={id("doc_type")} name="doc_type" value={values?.doc_type ?? "cc"} options={toOptions(DOC_TYPES)} />
        </Field>
        <Field id={id("doc_number")} label="Número de documento">
          <Input id={id("doc_number")} name="doc_number" required maxLength={30} defaultValue={values?.doc_number} />
        </Field>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <h3 className="text-sm font-medium text-muted-foreground sm:col-span-2">Trabajo</h3>
        {area === "planta" ? (
          <input type="hidden" name="worker_type" value="planta" />
        ) : (
          <div className="sm:col-span-2">
            <Field id={id("worker_type")} label="Tipo de trabajador">
              <Select name="worker_type" value={workerType} onValueChange={setWorkerType}>
                <SelectTrigger id={id("worker_type")} className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="temporal">{WORKER_TYPES.temporal}</SelectItem>
                  <SelectItem value="por_horas">{WORKER_TYPES.por_horas}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}
        <WorkerCategoryPicker
          id={id("category_id")}
          categories={categories}
          defaultValue={values?.category_id ?? ""}
        />
        <PositionPicker
          id={id("position_id")}
          positions={positions}
          defaultValue={values?.position_id ?? ""}
        />
        <Field id={id("contract_type")} label="Tipo de contrato">
          <Choice
            id={id("contract_type")}
            name="contract_type"
            value={values?.contract_type ?? "indefinido"}
            options={toOptions(CONTRACT_TYPES)}
          />
        </Field>
        <Field id={id("work_schedule")} label="Jornada">
          <Choice
            id={id("work_schedule")}
            name="work_schedule"
            value={values?.work_schedule ?? "completa"}
            options={toOptions(WORK_SCHEDULES)}
          />
        </Field>
        {hourly ? (
          <Field id={id("hourly_rate")} label="Valor hora">
            <Input
              id={id("hourly_rate")}
              name="hourly_rate"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={values?.hourly_rate ?? 0}
            />
          </Field>
        ) : (
          <Field id={id("salary")} label="Salario mensual">
            <Input
              id={id("salary")}
              name="salary"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={values?.salary ?? 0}
            />
          </Field>
        )}
        <Field id={id("hire_date")} label="Fecha de ingreso">
          <Input id={id("hire_date")} name="hire_date" type="date" defaultValue={values?.hire_date ?? ""} />
        </Field>
        {workerType === "temporal" ? (
          <Field id={id("end_date")} label="Fecha de término">
            <Input id={id("end_date")} name="end_date" type="date" defaultValue={values?.end_date ?? ""} />
          </Field>
        ) : null}
        <Field id={id("cost_classification")} label="Su pago es (para finanzas)">
          <Choice
            id={id("cost_classification")}
            name="cost_classification"
            value={values?.cost_classification ?? ""}
            none="Sin clasificar"
            options={toOptions(COST_CLASSIFICATIONS)}
          />
        </Field>
        <div>
          <Field id={id("warehouse_id")} label="Bodega o sucursal donde trabaja">
            <Choice
              id={id("warehouse_id")}
              name="warehouse_id"
              value={values?.warehouse_id ?? ""}
              none="Sin asignar"
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          </Field>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <h3 className="text-sm font-medium text-muted-foreground sm:col-span-3">Seguridad social</h3>
        <Field id={id("eps")} label="EPS">
          <Input id={id("eps")} name="eps" maxLength={80} defaultValue={values?.eps ?? ""} />
        </Field>
        <Field id={id("pension_fund")} label="Fondo de pensión">
          <Input id={id("pension_fund")} name="pension_fund" maxLength={80} defaultValue={values?.pension_fund ?? ""} />
        </Field>
        <Field id={id("arl_risk_class")} label="Clase de riesgo ARL (1-5)">
          <Input
            id={id("arl_risk_class")}
            name="arl_risk_class"
            type="number"
            min={1}
            max={5}
            step={1}
            defaultValue={values?.arl_risk_class ?? ""}
          />
        </Field>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <h3 className="text-sm font-medium text-muted-foreground sm:col-span-2">Contacto</h3>
        <Field id={id("phone")} label="Teléfono">
          <Input id={id("phone")} name="phone" type="tel" maxLength={30} defaultValue={values?.phone ?? ""} />
        </Field>
        <Field id={id("email")} label="Correo">
          <Input id={id("email")} name="email" type="email" maxLength={160} defaultValue={values?.email ?? ""} />
        </Field>
        <div className="sm:col-span-2">
          <Field id={id("address")} label="Dirección">
            <Input id={id("address")} name="address" maxLength={200} defaultValue={values?.address ?? ""} />
          </Field>
        </div>
        <Field id={id("emergency_contact_name")} label="Persona de contacto de urgencia">
          <Input
            id={id("emergency_contact_name")}
            name="emergency_contact_name"
            maxLength={120}
            defaultValue={values?.emergency_contact_name ?? ""}
          />
        </Field>
        <Field id={id("emergency_phone")} label="Teléfono de urgencia">
          <Input
            id={id("emergency_phone")}
            name="emergency_phone"
            type="tel"
            maxLength={30}
            defaultValue={values?.emergency_phone ?? ""}
          />
        </Field>
      </section>
    </div>
  );
}
