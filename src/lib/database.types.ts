export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      advisor_questions: {
        Row: {
          answer: string
          asked_by: string
          created_at: string
          id: string
          question: string
          range_from: string
          range_to: string
          tenant_id: string
        }
        Insert: {
          answer: string
          asked_by?: string
          created_at?: string
          id?: string
          question: string
          range_from: string
          range_to: string
          tenant_id: string
        }
        Update: {
          answer?: string
          asked_by?: string
          created_at?: string
          id?: string
          question?: string
          range_from?: string
          range_to?: string
          tenant_id?: string
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          detail: string | null
          entity_id: string | null
          id: string
          tenant_id: string
          worker_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string
          created_at?: string
          detail?: string | null
          entity_id?: string | null
          id?: string
          tenant_id: string
          worker_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          detail?: string | null
          entity_id?: string | null
          id?: string
          tenant_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          counted_amount: number | null
          created_at: string
          created_by: string
          difference: number | null
          expected_amount: number | null
          id: string
          note: string | null
          opened_at: string
          opened_by: string
          opening_amount: number
          status: string
          tenant_id: string
        }
        Insert: {
          closed_at?: string | null
          counted_amount?: number | null
          created_at?: string
          created_by?: string
          difference?: number | null
          expected_amount?: number | null
          id?: string
          note?: string | null
          opened_at?: string
          opened_by: string
          opening_amount: number
          status?: string
          tenant_id: string
        }
        Update: {
          closed_at?: string | null
          counted_amount?: number | null
          created_at?: string
          created_by?: string
          difference?: number | null
          expected_amount?: number | null
          id?: string
          note?: string | null
          opened_at?: string
          opened_by?: string
          opening_amount?: number
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "cash_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_interactions: {
        Row: {
          created_at: string
          created_by: string
          customer_id: string
          id: string
          kind: string
          note: string
          occurred_at: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          customer_id: string
          id?: string
          kind: string
          note: string
          occurred_at?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_id?: string
          id?: string
          kind?: string
          note?: string
          occurred_at?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_balances"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_history"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_interactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "customer_interactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payments: {
        Row: {
          amount: number
          cash_session_id: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          id: string
          method: string
          note: string | null
          paid_at: string
          sale_id: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          cash_session_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          id?: string
          method: string
          note?: string | null
          paid_at?: string
          sale_id?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          cash_session_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          id?: string
          method?: string
          note?: string | null
          paid_at?: string
          sale_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_session_summary"
            referencedColumns: ["cash_session_id"]
          },
          {
            foreignKeyName: "customer_payments_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_balances"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_history"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "customer_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          created_by: string | null
          doc_number: string | null
          doc_type: string | null
          email: string | null
          id: string
          is_generic: boolean
          name: string
          note: string | null
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          created_by?: string | null
          doc_number?: string | null
          doc_type?: string | null
          email?: string | null
          id?: string
          is_generic?: boolean
          name: string
          note?: string | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          created_by?: string | null
          doc_number?: string | null
          doc_type?: string | null
          email?: string | null
          id?: string
          is_generic?: boolean
          name?: string
          note?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dian_counters: {
        Row: {
          last_consecutive: number
          tenant_id: string
        }
        Insert: {
          last_consecutive?: number
          tenant_id: string
        }
        Update: {
          last_consecutive?: number
          tenant_id?: string
        }
        Relationships: []
      }
      dian_settings: {
        Row: {
          address: string | null
          city: string | null
          company_name: string
          department: string | null
          dv: string
          email: string | null
          nit: string
          phone: string | null
          software_id: string
          software_pin: string
          tenant_id: string
          test_set_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name: string
          department?: string | null
          dv: string
          email?: string | null
          nit: string
          phone?: string | null
          software_id: string
          software_pin: string
          tenant_id: string
          test_set_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string
          department?: string | null
          dv?: string
          email?: string | null
          nit?: string
          phone?: string | null
          software_id?: string
          software_pin?: string
          tenant_id?: string
          test_set_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          kind: string
          name: string
          pnl_line: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          kind: string
          name: string
          pnl_line?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          kind?: string
          name?: string
          pnl_line?: string
          tenant_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string
          description: string
          id: string
          kind: string
          method: string
          paid_at: string
          supplier_id: string | null
          tax_amount: number
          tenant_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by: string
          description: string
          id?: string
          kind: string
          method: string
          paid_at?: string
          supplier_id?: string | null
          tax_amount?: number
          tenant_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          kind?: string
          method?: string
          paid_at?: string
          supplier_id?: string | null
          tax_amount?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_balances"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          category_id: string | null
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          role: string
          tenant_id: string
          token: string
          worker_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string
          email: string
          expires_at?: string
          id?: string
          role: string
          tenant_id: string
          token?: string
          worker_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          role?: string
          tenant_id?: string
          token?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "worker_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          can_approve_purchases: boolean
          category_id: string | null
          created_at: string
          created_by: string
          display_name: string | null
          id: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          can_approve_purchases?: boolean
          category_id?: string | null
          created_at?: string
          created_by?: string
          display_name?: string | null
          id?: string
          role: string
          tenant_id: string
          user_id: string
        }
        Update: {
          can_approve_purchases?: boolean
          category_id?: string | null
          created_at?: string
          created_by?: string
          display_name?: string | null
          id?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "worker_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string
          id: string
          period_end: string
          period_start: string
          status: string
          tenant_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          period_end: string
          period_start: string
          status?: string
          tenant_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          period_end?: string
          period_start?: string
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      payroll_settlements: {
        Row: {
          created_at: string
          days_worked: number
          dian_consecutive: number | null
          dian_cune: string | null
          dian_generated_at: string | null
          dian_status: string
          dian_xml: string | null
          extra_diurna: number
          extra_nocturna: number
          gross_earnings: number
          horas_dominical_festivo: number
          hours_worked: number
          id: string
          net_pay: number
          period_id: string
          recargo_nocturno: number
          result: Json
          tenant_id: string
          total_deductions: number
          updated_at: string
          weekly_hours: number
          worker_id: string
        }
        Insert: {
          created_at?: string
          days_worked?: number
          dian_consecutive?: number | null
          dian_cune?: string | null
          dian_generated_at?: string | null
          dian_status?: string
          dian_xml?: string | null
          extra_diurna?: number
          extra_nocturna?: number
          gross_earnings?: number
          horas_dominical_festivo?: number
          hours_worked?: number
          id?: string
          net_pay?: number
          period_id: string
          recargo_nocturno?: number
          result?: Json
          tenant_id: string
          total_deductions?: number
          updated_at?: string
          weekly_hours?: number
          worker_id: string
        }
        Update: {
          created_at?: string
          days_worked?: number
          dian_consecutive?: number | null
          dian_cune?: string | null
          dian_generated_at?: string | null
          dian_status?: string
          dian_xml?: string | null
          extra_diurna?: number
          extra_nocturna?: number
          gross_earnings?: number
          horas_dominical_festivo?: number
          hours_worked?: number
          id?: string
          net_pay?: number
          period_id?: string
          recargo_nocturno?: number
          result?: Json
          tenant_id?: string
          total_deductions?: number
          updated_at?: string
          weekly_hours?: number
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_settlements_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_settlements_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          created_by: string
          id: string
          inventory: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          inventory?: string
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          inventory?: string
          name?: string
          tenant_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          brand: string | null
          category_id: string | null
          color: string | null
          cost: number
          created_at: string
          created_by: string
          description: string | null
          discount_percent: number
          id: string
          inventory: string
          kind: string
          min_stock: number
          model: string | null
          name: string
          photo_url: string | null
          plate: string | null
          price: number
          purchase_date: string | null
          sales_channel: string
          serial_number: string | null
          sku: string
          tax_rate: number
          tenant_id: string
          unit: string
          updated_at: string
          vehicle_year: number | null
          weight_kg: number
        }
        Insert: {
          active?: boolean
          brand?: string | null
          category_id?: string | null
          color?: string | null
          cost?: number
          created_at?: string
          created_by?: string
          description?: string | null
          discount_percent?: number
          id?: string
          inventory?: string
          kind?: string
          min_stock?: number
          model?: string | null
          name: string
          photo_url?: string | null
          plate?: string | null
          price?: number
          purchase_date?: string | null
          sales_channel?: string
          serial_number?: string | null
          sku: string
          tax_rate?: number
          tenant_id: string
          unit?: string
          updated_at?: string
          vehicle_year?: number | null
          weight_kg?: number
        }
        Update: {
          active?: boolean
          brand?: string | null
          category_id?: string | null
          color?: string | null
          cost?: number
          created_at?: string
          created_by?: string
          description?: string | null
          discount_percent?: number
          id?: string
          inventory?: string
          kind?: string
          min_stock?: number
          model?: string | null
          name?: string
          photo_url?: string | null
          plate?: string | null
          price?: number
          purchase_date?: string | null
          sales_channel?: string
          serial_number?: string | null
          sku?: string
          tax_rate?: number
          tenant_id?: string
          unit?: string
          updated_at?: string
          vehicle_year?: number | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          voided_at: string | null
          voided_by: string | null
          created_at: string
          created_by: string
          cufe: string | null
          due_on: string | null
          file_path: string | null
          id: string
          issued_on: string
          number: string
          purchase_id: string
          subtotal: number
          supplier_id: string
          tax: number
          tenant_id: string
          total: number
          warehouse_id: string | null
        }
        Insert: {
          voided_at?: string | null
          voided_by?: string | null
          created_at?: string
          created_by?: string
          cufe?: string | null
          due_on?: string | null
          file_path?: string | null
          id?: string
          issued_on: string
          number: string
          purchase_id: string
          subtotal: number
          supplier_id: string
          tax: number
          tenant_id: string
          total: number
          warehouse_id?: string | null
        }
        Update: {
          voided_at?: string | null
          voided_by?: string | null
          created_at?: string
          created_by?: string
          cufe?: string | null
          due_on?: string | null
          file_path?: string | null
          id?: string
          issued_on?: string
          number?: string
          purchase_id?: string
          subtotal?: number
          supplier_id?: string
          tax?: number
          tenant_id?: string
          total?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          warehouse_id: string | null
          received_qty: number
          created_at: string
          id: string
          product_id: string
          purchase_id: string
          qty: number
          tax_rate: number
          tenant_id: string
          unit_cost: number
        }
        Insert: {
          warehouse_id?: string | null
          received_qty?: number
          created_at?: string
          id?: string
          product_id: string
          purchase_id: string
          qty: number
          tax_rate?: number
          tenant_id: string
          unit_cost: number
        }
        Update: {
          warehouse_id?: string | null
          received_qty?: number
          created_at?: string
          id?: string
          product_id?: string
          purchase_id?: string
          qty?: number
          tax_rate?: number
          tenant_id?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "low_stock_alerts"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profitability"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "purchase_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_counters: {
        Row: {
          last_no: number
          tenant_id: string
        }
        Insert: {
          last_no?: number
          tenant_id: string
        }
        Update: {
          last_no?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "purchase_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipt_lines: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invoice_id: string
          movement_id: string
          product_id: string
          purchase_item_id: string
          qty: number
          tax_rate: number
          tenant_id: string
          unit_cost: number
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          invoice_id: string
          movement_id: string
          product_id: string
          purchase_item_id: string
          qty: number
          tax_rate: number
          tenant_id: string
          unit_cost: number
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invoice_id?: string
          movement_id?: string
          product_id?: string
          purchase_item_id?: string
          qty?: number
          tax_rate?: number
          tenant_id?: string
          unit_cost?: number
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipt_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_lines_purchase_item_id_fkey"
            columns: ["purchase_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          closed_short: boolean
          invoiced_total: number | null
          shortage_note: string | null
          approved_at: string | null
          approved_by: string | null
          approved_by_name: string | null
          created_at: string
          created_by: string
          id: string
          issued_at: string | null
          note: string | null
          number: number
          ordered_by_name: string | null
          received_at: string | null
          requested_at: string | null
          requested_by_name: string | null
          status: string
          subtotal: number
          supplier_id: string
          tax: number
          tenant_id: string
          total: number
          updated_at: string
        }
        Insert: {
          closed_short?: boolean
          invoiced_total?: number | null
          shortage_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          created_at?: string
          created_by?: string
          id?: string
          issued_at?: string | null
          note?: string | null
          number?: number
          ordered_by_name?: string | null
          received_at?: string | null
          requested_at?: string | null
          requested_by_name?: string | null
          status?: string
          subtotal?: number
          supplier_id: string
          tax?: number
          tenant_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          closed_short?: boolean
          invoiced_total?: number | null
          shortage_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          created_at?: string
          created_by?: string
          id?: string
          issued_at?: string | null
          note?: string | null
          number?: number
          ordered_by_name?: string | null
          received_at?: string | null
          requested_at?: string | null
          requested_by_name?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string
          tax?: number
          tenant_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_balances"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "purchases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_items: {
        Row: {
          component_product_id: string
          created_at: string
          created_by: string
          id: string
          product_id: string
          qty: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          component_product_id: string
          created_at?: string
          created_by?: string
          id?: string
          product_id: string
          qty: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          component_product_id?: string
          created_at?: string
          created_by?: string
          id?: string
          product_id?: string
          qty?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_items_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "low_stock_alerts"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "recipe_items_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "product_profitability"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "recipe_items_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "products_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "low_stock_alerts"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "recipe_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profitability"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "recipe_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "recipe_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_counters: {
        Row: {
          last_no: number
          tenant_id: string
        }
        Insert: {
          last_no?: number
          tenant_id: string
        }
        Update: {
          last_no?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "sale_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          discount: number
          id: string
          product_id: string
          qty: number
          sale_id: string
          tax_rate: number
          tenant_id: string
          unit_cost: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount?: number
          id?: string
          product_id: string
          qty: number
          sale_id: string
          tax_rate?: number
          tenant_id: string
          unit_cost?: number | null
          unit_price: number
        }
        Update: {
          created_at?: string
          discount?: number
          id?: string
          product_id?: string
          qty?: number
          sale_id?: string
          tax_rate?: number
          tenant_id?: string
          unit_cost?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "low_stock_alerts"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profitability"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "sale_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          payment_proof_at: string | null
          payment_proof_count: number
          payment_proof_path: string | null
          public_token: string | null
          source: string
          store_payment: string | null
          cash_session_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          delivered_at: string | null
          delivery_method: string | null
          document_type: string
          id: string
          invoice_issued_at: string | null
          issued_at: string | null
          note: string | null
          payment_method: string | null
          receipt_number: number | null
          refund_reason: string | null
          refunded_at: string | null
          refunded_by: string | null
          shipped_at: string | null
          shipping_address: string | null
          shipping_cost: number
          shipping_km: number | null
          shipping_rate_id: string | null
          status: string
          subtotal: number
          tax: number
          tenant_id: string
          total: number
          updated_at: string
        }
        Insert: {
          payment_proof_at?: string | null
          payment_proof_count?: number
          payment_proof_path?: string | null
          public_token?: string | null
          source?: string
          store_payment?: string | null
          cash_session_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_method?: string | null
          document_type?: string
          id?: string
          invoice_issued_at?: string | null
          issued_at?: string | null
          note?: string | null
          payment_method?: string | null
          receipt_number?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          shipped_at?: string | null
          shipping_address?: string | null
          shipping_cost?: number
          shipping_km?: number | null
          shipping_rate_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          tenant_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          payment_proof_at?: string | null
          payment_proof_count?: number
          payment_proof_path?: string | null
          public_token?: string | null
          source?: string
          store_payment?: string | null
          cash_session_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_method?: string | null
          document_type?: string
          id?: string
          invoice_issued_at?: string | null
          issued_at?: string | null
          note?: string | null
          payment_method?: string | null
          receipt_number?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          shipped_at?: string | null
          shipping_address?: string | null
          shipping_cost?: number
          shipping_km?: number | null
          shipping_rate_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          tenant_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_session_summary"
            referencedColumns: ["cash_session_id"]
          },
          {
            foreignKeyName: "sales_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_balances"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_history"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rates: {
        Row: {
          base_price: number
          created_at: string
          created_by: string
          id: string
          name: string
          price_per_kg: number
          price_per_km: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          base_price?: number
          created_at?: string
          created_by?: string
          id?: string
          name: string
          price_per_kg?: number
          price_per_km?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          price_per_kg?: number
          price_per_km?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string
          id: string
          kind: string
          note: string | null
          product_id: string
          qty: number
          ref_id: string | null
          ref_type: string | null
          tenant_id: string
          unit_cost: number
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          kind: string
          note?: string | null
          product_id: string
          qty: number
          ref_id?: string | null
          ref_type?: string | null
          tenant_id: string
          unit_cost: number
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          note?: string | null
          product_id?: string
          qty?: number
          ref_id?: string | null
          ref_type?: string | null
          tenant_id?: string
          unit_cost?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "low_stock_alerts"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profitability"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          method: string
          note: string | null
          paid_at: string
          purchase_id: string | null
          supplier_id: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string
          id?: string
          method: string
          note?: string | null
          paid_at?: string
          purchase_id?: string | null
          supplier_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          method?: string
          note?: string | null
          paid_at?: string
          purchase_id?: string | null
          supplier_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_balances"
            referencedColumns: ["supplier_id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "supplier_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_products: {
        Row: {
          created_at: string
          created_by: string
          id: string
          last_purchased_at: string | null
          product_id: string
          supplier_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          last_purchased_at?: string | null
          product_id: string
          supplier_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          last_purchased_at?: string | null
          product_id?: string
          supplier_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_product_id_tenant_id_fkey"
            columns: ["product_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "low_stock_alerts"
            referencedColumns: ["product_id", "tenant_id"]
          },
          {
            foreignKeyName: "supplier_products_product_id_tenant_id_fkey"
            columns: ["product_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "product_profitability"
            referencedColumns: ["product_id", "tenant_id"]
          },
          {
            foreignKeyName: "supplier_products_product_id_tenant_id_fkey"
            columns: ["product_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "supplier_products_product_id_tenant_id_fkey"
            columns: ["product_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "products_catalog"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "supplier_products_supplier_id_tenant_id_fkey"
            columns: ["supplier_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "supplier_balances"
            referencedColumns: ["supplier_id", "tenant_id"]
          },
          {
            foreignKeyName: "supplier_products_supplier_id_tenant_id_fkey"
            columns: ["supplier_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "supplier_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "supplier_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          name: string
          nit: string | null
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          name: string
          nit?: string | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          name?: string
          nit?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          store_bank_info: string | null
          store_cash_on_delivery: boolean
          store_daviplata: string | null
          store_nequi: string | null
          store_pay_in_store: boolean
          store_payment_qr_url: string | null
          store_color: string | null
          store_enabled: boolean
          store_slug: string | null
          address: string | null
          city: string | null
          created_at: string
          currency: string
          email: string | null
          id: string
          income_tax_rate: number
          logo_url: string | null
          name: string
          nit: string | null
          person_type: string
          phone: string | null
          sells_physical: boolean
          sells_virtual: boolean
        }
        Insert: {
          store_bank_info?: string | null
          store_cash_on_delivery?: boolean
          store_daviplata?: string | null
          store_nequi?: string | null
          store_pay_in_store?: boolean
          store_payment_qr_url?: string | null
          store_color?: string | null
          store_enabled?: boolean
          store_slug?: string | null
          address?: string | null
          city?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          income_tax_rate?: number
          logo_url?: string | null
          name: string
          nit?: string | null
          person_type?: string
          phone?: string | null
          sells_physical?: boolean
          sells_virtual?: boolean
        }
        Update: {
          store_bank_info?: string | null
          store_cash_on_delivery?: boolean
          store_daviplata?: string | null
          store_nequi?: string | null
          store_pay_in_store?: boolean
          store_payment_qr_url?: string | null
          store_color?: string | null
          store_enabled?: boolean
          store_slug?: string | null
          address?: string | null
          city?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          income_tax_rate?: number
          logo_url?: string | null
          name?: string
          nit?: string | null
          person_type?: string
          phone?: string | null
          sells_physical?: boolean
          sells_virtual?: boolean
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          active: boolean
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string
          department: string | null
          id: string
          is_default: boolean
          lends_stock: boolean
          name: string
          phone: string | null
          postal_code: string | null
          tenant_id: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string
          department?: string | null
          id?: string
          is_default?: boolean
          lends_stock?: boolean
          name: string
          phone?: string | null
          postal_code?: string | null
          tenant_id: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string
          department?: string | null
          id?: string
          is_default?: boolean
          lends_stock?: boolean
          name?: string
          phone?: string | null
          postal_code?: string | null
          tenant_id?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "warehouses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_categories: {
        Row: {
          created_at: string
          created_by: string
          id: string
          modules: string[]
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          modules?: string[]
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          modules?: string[]
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      worker_leaves: {
        Row: {
          created_at: string
          created_by: string
          end_date: string
          id: string
          note: string | null
          start_date: string
          tenant_id: string
          type: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          end_date: string
          id?: string
          note?: string | null
          start_date: string
          tenant_id: string
          type: string
          worker_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          end_date?: string
          id?: string
          note?: string | null
          start_date?: string
          tenant_id?: string
          type?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_leaves_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_login_attempts: {
        Row: {
          attempted_at: string
          attempted_by: string | null
          id: string
          success: boolean
          tenant_id: string
          username: string
          worker_id: string | null
        }
        Insert: {
          attempted_at?: string
          attempted_by?: string | null
          id?: string
          success: boolean
          tenant_id: string
          username: string
          worker_id?: string | null
        }
        Update: {
          attempted_at?: string
          attempted_by?: string | null
          id?: string
          success?: boolean
          tenant_id?: string
          username?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_login_attempts_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_positions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: []
      }
      workers: {
        Row: {
          active: boolean
          address: string | null
          arl_risk_class: number | null
          category_id: string | null
          contract_type: string
          cost_classification: string | null
          created_at: string
          created_by: string
          doc_number: string
          doc_type: string
          email: string | null
          emergency_contact_name: string | null
          emergency_phone: string | null
          end_date: string | null
          eps: string | null
          full_name: string
          hire_date: string | null
          hourly_rate: number
          id: string
          pension_fund: string | null
          phone: string | null
          pin_hash: string | null
          position_id: string | null
          salary: number
          tenant_id: string
          updated_at: string
          user_id: string | null
          username: string | null
          warehouse_id: string | null
          work_schedule: string
          worker_type: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          arl_risk_class?: number | null
          category_id?: string | null
          contract_type?: string
          cost_classification?: string | null
          created_at?: string
          created_by?: string
          doc_number: string
          doc_type?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_phone?: string | null
          end_date?: string | null
          eps?: string | null
          full_name: string
          hire_date?: string | null
          hourly_rate?: number
          id?: string
          pension_fund?: string | null
          phone?: string | null
          pin_hash?: string | null
          position_id?: string | null
          salary?: number
          tenant_id: string
          updated_at?: string
          user_id?: string | null
          username?: string | null
          warehouse_id?: string | null
          work_schedule?: string
          worker_type?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          arl_risk_class?: number | null
          category_id?: string | null
          contract_type?: string
          cost_classification?: string | null
          created_at?: string
          created_by?: string
          doc_number?: string
          doc_type?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_phone?: string | null
          end_date?: string | null
          eps?: string | null
          full_name?: string
          hire_date?: string | null
          hourly_rate?: number
          id?: string
          pension_fund?: string | null
          phone?: string | null
          pin_hash?: string | null
          position_id?: string | null
          salary?: number
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
          username?: string | null
          warehouse_id?: string | null
          work_schedule?: string
          worker_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      cash_flow: {
        Row: {
          cash_in: number | null
          cash_out: number | null
          month: string | null
          net_cash: number | null
          tenant_id: string | null
        }
        Relationships: []
      }
      cash_session_summary: {
        Row: {
          card_total: number | null
          cash_session_id: string | null
          cash_total: number | null
          closed_at: string | null
          counted_amount: number | null
          difference: number | null
          expected_amount: number | null
          opened_at: string | null
          opened_by: string | null
          opening_amount: number | null
          other_total: number | null
          sales_count: number | null
          sales_total: number | null
          status: string | null
          tenant_id: string | null
          transfer_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "cash_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      current_stock: {
        Row: {
          product_id: string | null
          tenant_id: string | null
          total_qty: number | null
          total_value: number | null
          warehouse_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "low_stock_alerts"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profitability"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_balances: {
        Row: {
          balance: number | null
          customer_id: string | null
          customer_name: string | null
          doc_number: string | null
          tenant_id: string | null
          total_paid: number | null
          total_sales: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_history: {
        Row: {
          average_ticket: number | null
          customer_id: string | null
          customer_name: string | null
          doc_number: string | null
          doc_type: string | null
          last_sale_at: string | null
          tenant_id: string | null
          total_sales_amount: number | null
          total_sales_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_metrics: {
        Row: {
          current_month_sales: number | null
          current_month_utility: number | null
          inventory_value: number | null
          tenant_id: string | null
          total_payable: number | null
          total_receivable: number | null
        }
        Relationships: []
      }
      kardex: {
        Row: {
          accumulated_qty: number | null
          accumulated_value: number | null
          average_cost: number | null
          date: string | null
          kind: string | null
          movement_id: string | null
          product_id: string | null
          qty: number | null
          ref_id: string | null
          ref_type: string | null
          tenant_id: string | null
          unit_cost: number | null
          warehouse_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "low_stock_alerts"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_profitability"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      low_stock_alerts: {
        Row: {
          min_stock: number | null
          name: string | null
          out_of_stock: boolean | null
          product_id: string | null
          sku: string | null
          tenant_id: string | null
          total_qty: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_expenses: {
        Row: {
          amount: number | null
          category: string | null
          kind: string | null
          month: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_payroll: {
        Row: {
          cash_out: number | null
          classification: string | null
          labor_cost: number | null
          month: string | null
          tenant_id: string | null
        }
        Relationships: []
      }
      monthly_pnl: {
        Row: {
          cogs: number | null
          expenses: number | null
          income: number | null
          month: string | null
          payroll_costs: number | null
          payroll_expenses: number | null
          tenant_id: string | null
          utility: number | null
        }
        Relationships: []
      }
      product_profitability: {
        Row: {
          margin_amount: number | null
          margin_percent: number | null
          name: string | null
          net_income: number | null
          product_id: string | null
          sku: string | null
          sold_qty: number | null
          tenant_id: string | null
          total_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products_catalog: {
        Row: {
          active: boolean | null
          brand: string | null
          category_id: string | null
          color: string | null
          cost: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          discount_percent: number | null
          id: string | null
          inventory: string | null
          kind: string | null
          min_stock: number | null
          model: string | null
          name: string | null
          photo_url: string | null
          plate: string | null
          price: number | null
          purchase_date: string | null
          sales_channel: string | null
          serial_number: string | null
          sku: string | null
          tax_rate: number | null
          tenant_id: string | null
          unit: string | null
          updated_at: string | null
          vehicle_year: number | null
          weight_kg: number | null
        }
        Insert: {
          active?: boolean | null
          category_id?: string | null
          cost?: never
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_percent?: number | null
          id?: string | null
          kind?: string | null
          min_stock?: number | null
          name?: string | null
          photo_url?: string | null
          price?: never
          sales_channel?: string | null
          sku?: string | null
          tax_rate?: never
          tenant_id?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          category_id?: string | null
          cost?: never
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_percent?: number | null
          id?: string | null
          kind?: string | null
          min_stock?: number | null
          name?: string | null
          photo_url?: string | null
          price?: never
          sales_channel?: string | null
          sku?: string | null
          tax_rate?: never
          tenant_id?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_balances: {
        Row: {
          balance: number | null
          supplier_id: string | null
          supplier_name: string | null
          supplier_nit: string | null
          tenant_id: string | null
          total_paid: number | null
          total_purchases: number | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "dashboard_metrics"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_price_history: {
        Row: {
          change_percent: number | null
          created_at: string | null
          invoice_number: string | null
          issued_on: string | null
          line_id: string | null
          prev_cost: number | null
          product_id: string | null
          product_name: string | null
          qty: number | null
          supplier_id: string | null
          supplier_name: string | null
          tenant_id: string | null
          unit_cost: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      active_worker_modules: {
        Args: { p_tenant_id: string; p_worker_id: string }
        Returns: { full_name: string; modules: string[] }[]
      }
      cancel_purchase: { Args: { p_purchase_id: string }; Returns: undefined }
      cancel_sale: { Args: { p_sale_id: string }; Returns: undefined }
      checkout_counter_sale: {
        Args: {
          p_allocations?: Json
          p_customer_id: string
          p_document_type?: string
          p_items: Json
          p_note?: string
          p_payment_method: string
          p_tenant_id: string
          p_warehouse_id: string
        }
        Returns: string
      }
      clear_worker_pin: {
        Args: { p_worker_id: string }
        Returns: undefined
      }
      close_cash_session: {
        Args: {
          p_counted_amount: number
          p_note?: string
          p_session_id?: string
        }
        Returns: string
      }
      close_purchase_short: {
        Args: { p_note: string | null; p_purchase_id: string }
        Returns: undefined
      }
      confirm_sale: {
        Args: { p_sale_id: string; p_warehouse_id: string }
        Returns: undefined
      }
      confirm_sale_allocated: {
        Args: { p_allocations: Json; p_sale_id: string; p_warehouse_id: string }
        Returns: undefined
      }
      create_payroll_period: {
        Args: { p_end: string; p_settlements: Json; p_start: string; p_tenant_id: string }
        Returns: string
      }
      create_product_with_stock: {
        Args: {
          p_cost: number
          p_description?: string
          p_kind: string
          p_min_stock: number
          p_name: string
          p_price: number
          p_qty?: number
          p_sku: string
          p_tax_rate: number
          p_tenant_id: string
          p_unit: string
          p_warehouse_id?: string
        }
        Returns: string
      }
      create_purchase: {
        Args: {
          p_items: Json
          p_note?: string
          p_status: string
          p_supplier_id: string
        }
        Returns: string
      }
      create_purchase_invoice: {
        Args: {
          p_cufe: string | null
          p_due_on: string | null
          p_file_path: string | null
          p_issued_on: string
          p_number: string
          p_purchase_id: string
          p_subtotal: number
          p_tax: number
          p_total: number
          p_warehouse_id: string | null
        }
        Returns: string
      }
      create_sale: {
        Args: {
          p_customer_id?: string
          p_delivery_method?: string
          p_items: Json
          p_note?: string
          p_payment_method?: string
          p_shipping_cost?: number
          p_shipping_km?: number
          p_shipping_rate_id?: string
          p_tenant_id: string
        }
        Returns: string
      }
      create_tenant_with_owner: {
        Args: {
          p_name: string
          p_nit?: string
          p_sells_physical?: boolean
          p_sells_virtual?: boolean
        }
        Returns: string
      }
      default_sale_warehouse: {
        Args: { p_tenant_id: string; p_worker_id?: string }
        Returns: string
      }
      inventory_history: {
        Args: {
          p_from: string
          p_inventory: string
          p_to: string
          p_warehouse_id?: string
        }
        Returns: {
          cost: number
          price: number
          product_id: string
          product_name: string
          sku: string
          stock: number
          unit: string
          warehouse_id: string
          warehouse_name: string
        }[]
      }
      approve_purchase: { Args: { p_purchase_id: string }; Returns: undefined }
      mark_purchase_ordered: {
        Args: { p_purchase_id: string }
        Returns: undefined
      }
      mark_invoice_issued: { Args: { p_sale_id: string }; Returns: undefined }
      mark_sale_delivered: { Args: { p_sale_id: string }; Returns: undefined }
      mark_sale_shipped: {
        Args: { p_sale_id: string; p_shipping_address: string }
        Returns: undefined
      }
      next_dian_consecutive: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      open_cash_session: {
        Args: { p_opening_amount: number; p_tenant_id: string }
        Returns: string
      }
      receive_purchase: {
        Args: { p_purchase_id: string; p_warehouse_id: string }
        Returns: undefined
      }
      receive_purchase_line: {
        Args: {
          p_invoice_id: string
          p_purchase_item_id: string
          p_qty: number
          p_sale_price?: number
          p_tax_rate?: number
          p_unit_cost?: number
        }
        Returns: string
      }
      refund_sale: {
        Args: { p_reason: string; p_receipt_number: number; p_tenant_id: string }
        Returns: string
      }
      register_customer_payment: {
        Args: {
          p_amount: number
          p_customer_id: string
          p_method: string
          p_note?: string
          p_paid_at: string
          p_sale_id: string
        }
        Returns: string
      }
      register_movement: {
        Args: {
          p_kind: string
          p_note?: string
          p_product_id: string
          p_qty: number
          p_ref_id?: string
          p_ref_type?: string
          p_unit_cost: number
          p_warehouse_id: string
        }
        Returns: string
      }
      register_production: {
        Args: {
          p_consumptions: Json
          p_output_qty: number
          p_product_id: string
          p_tenant_id: string
          p_warehouse_id: string
        }
        Returns: undefined
      }
      register_supplier_payment: {
        Args: {
          p_amount: number
          p_method: string
          p_note?: string
          p_paid_at: string
          p_purchase_id: string
          p_supplier_id: string
        }
        Returns: string
      }
      save_recipe: {
        Args: { p_items: Json; p_product_id: string }
        Returns: undefined
      }
      set_product_stock: {
        Args: { p_levels: Json; p_product_id: string }
        Returns: number
      }
      user_can_approve_purchases: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      store_order_status: {
        Args: { p_slug: string; p_token: string }
        Returns: Json
      }
      store_catalog: {
        Args: { p_slug: string }
        Returns: {
          available: boolean
          category: string | null
          description: string | null
          discount_percent: number
          name: string
          photo_url: string | null
          price: number
          product_id: string
          tax_rate: number
        }[]
      }
      store_info: {
        Args: { p_slug: string }
        Returns: {
          address: string | null
          city: string | null
          currency: string
          email: string | null
          logo_url: string | null
          name: string
          payments: Json
          phone: string | null
          store_color: string | null
        }[]
      }
      attach_payment_proof: {
        Args: { p_path: string; p_token: string }
        Returns: undefined
      }
      place_store_order: {
        Args: {
          p_address?: string
          p_customer: Json
          p_delivery: string
          p_items: Json
          p_note?: string
          p_payment: string
          p_slug: string
        }
        Returns: { order_code: string; token: string; total: number }[]
      }
      set_purchase_approver: {
        Args: { p_membership_id: string; p_value: boolean }
        Returns: undefined
      }
      set_worker_pin: {
        Args: { p_pin: string; p_username: string; p_worker_id: string }
        Returns: undefined
      }
      transfer_stock: {
        Args: { p_from: string; p_items: Json; p_note?: string; p_to: string }
        Returns: string
      }
      update_purchase: {
        Args: {
          p_items: Json
          p_note?: string
          p_purchase_id: string
          p_supplier_id: string
        }
        Returns: undefined
      }
      user_is_tenant_admin: { Args: { p_tenant_id: string }; Returns: boolean }
      user_tenant_ids: { Args: never; Returns: string[] }
      verify_worker_pin: {
        Args: { p_pin: string; p_tenant_id: string; p_username: string }
        Returns: { full_name: string; modules: string[]; worker_id: string }[]
      }
      update_purchase_invoice: {
        Args: {
          p_cufe: string | null
          p_due_on: string | null
          p_file_path: string | null
          p_invoice_id: string
          p_issued_on: string
          p_number: string
          p_subtotal: number
          p_tax: number
          p_total: number
        }
        Returns: undefined
      }
      void_purchase_invoice: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      void_purchase_receipt_line: {
        Args: { p_line_id: string }
        Returns: undefined
      }
    }

    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

