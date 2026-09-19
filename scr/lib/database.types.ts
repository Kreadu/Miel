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
          created_by: string
          doc_number: string | null
          doc_type: string | null
          email: string | null
          id: string
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
          created_by?: string
          doc_number?: string | null
          doc_type?: string | null
          email?: string | null
          id?: string
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
          created_by?: string
          doc_number?: string | null
          doc_type?: string | null
          email?: string | null
          id?: string
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
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          role: string
          tenant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string
          email: string
          expires_at?: string
          id?: string
          role: string
          tenant_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          role?: string
          tenant_id?: string
          token?: string
        }
        Relationships: [
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
          created_at: string
          created_by: string
          id: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          role: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
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
      products: {
        Row: {
          active: boolean
          cost: number
          created_at: string
          created_by: string
          description: string | null
          id: string
          kind: string
          min_stock: number
          name: string
          price: number
          sku: string
          tax_rate: number
          tenant_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cost?: number
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          kind?: string
          min_stock?: number
          name: string
          price?: number
          sku: string
          tax_rate?: number
          tenant_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cost?: number
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          kind?: string
          min_stock?: number
          name?: string
          price?: number
          sku?: string
          tax_rate?: number
          tenant_id?: string
          unit?: string
          updated_at?: string
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
      purchase_items: {
        Row: {
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
      purchases: {
        Row: {
          created_at: string
          created_by: string
          id: string
          issued_at: string | null
          note: string | null
          received_at: string | null
          status: string
          subtotal: number
          supplier_id: string
          tax: number
          tenant_id: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          issued_at?: string | null
          note?: string | null
          received_at?: string | null
          status?: string
          subtotal?: number
          supplier_id: string
          tax?: number
          tenant_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          issued_at?: string | null
          note?: string | null
          received_at?: string | null
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
          cash_session_id: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          delivered_at: string | null
          id: string
          issued_at: string | null
          note: string | null
          receipt_number: number | null
          shipped_at: string | null
          shipping_address: string | null
          status: string
          subtotal: number
          tax: number
          tenant_id: string
          total: number
          updated_at: string
        }
        Insert: {
          cash_session_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          delivered_at?: string | null
          id?: string
          issued_at?: string | null
          note?: string | null
          receipt_number?: number | null
          shipped_at?: string | null
          shipping_address?: string | null
          status?: string
          subtotal?: number
          tax?: number
          tenant_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          cash_session_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          delivered_at?: string | null
          id?: string
          issued_at?: string | null
          note?: string | null
          receipt_number?: number | null
          shipped_at?: string | null
          shipping_address?: string | null
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
          created_at: string
          currency: string
          id: string
          name: string
          nit: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          name: string
          nit?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          name?: string
          nit?: string | null
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          id: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
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
      monthly_pnl: {
        Row: {
          cogs: number | null
          expenses: number | null
          income: number | null
          month: string | null
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
          cost: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string | null
          kind: string | null
          min_stock: number | null
          name: string | null
          price: number | null
          sku: string | null
          tax_rate: number | null
          tenant_id: string | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          cost?: never
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          kind?: string | null
          min_stock?: number | null
          name?: string | null
          price?: never
          sku?: string | null
          tax_rate?: never
          tenant_id?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          cost?: never
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          kind?: string | null
          min_stock?: number | null
          name?: string | null
          price?: never
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
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      cancel_purchase: { Args: { p_purchase_id: string }; Returns: undefined }
      close_cash_session: {
        Args: {
          p_counted_amount: number
          p_note?: string
          p_session_id?: string
        }
        Returns: string
      }
      confirm_sale: {
        Args: { p_sale_id: string; p_warehouse_id: string }
        Returns: undefined
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
      create_sale: {
        Args: {
          p_customer_id?: string
          p_items: Json
          p_note?: string
          p_tenant_id: string
        }
        Returns: string
      }
      create_tenant_with_owner: {
        Args: { p_name: string; p_nit?: string }
        Returns: string
      }
      mark_purchase_ordered: {
        Args: { p_purchase_id: string }
        Returns: undefined
      }
      mark_sale_delivered: { Args: { p_sale_id: string }; Returns: undefined }
      mark_sale_shipped: {
        Args: { p_sale_id: string; p_shipping_address: string }
        Returns: undefined
      }
      open_cash_session: {
        Args: { p_opening_amount: number; p_tenant_id: string }
        Returns: string
      }
      receive_purchase: {
        Args: { p_purchase_id: string; p_warehouse_id: string }
        Returns: undefined
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
      register_pos_sale: {
        Args: {
          p_customer_id?: string
          p_items: Json
          p_note?: string
          p_payments: Json
          p_tenant_id: string
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

