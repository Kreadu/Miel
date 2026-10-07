import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import { formatDate, formatMoney } from "@/lib/format";

import type { PurchaseDoc } from "./pdf-data";

export type PurchasePdfLabels = {
  title: string;
  date: string;
  supplier: string;
  sku: string;
  product: string;
  qty: string;
  unitCost: string;
  taxPercent: string;
  lineTotal: string;
  subtotal: string;
  tax: string;
  total: string;
  note: string;
  draft: string;
  signatures: { requested: string; approved: string; ordered: string };
};

export type PdfLogo = { data: Buffer; format: "png" | "jpg" } | null;

// Helvetica (incluida en PDF): cubre tildes y ñ sin embeber fuentes.
const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#222" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  logo: { width: 120, height: 48, objectFit: "contain" },
  companyName: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  muted: { color: "#666" },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", textAlign: "right" },
  draft: { marginTop: 4, color: "#b42318", fontFamily: "Helvetica-Bold", textAlign: "right" },
  section: { marginBottom: 14 },
  label: { fontFamily: "Helvetica-Bold", marginBottom: 2 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ccc", paddingVertical: 4 },
  head: { fontFamily: "Helvetica-Bold", borderBottomColor: "#222" },
  cSku: { width: "14%" },
  cName: { width: "34%" },
  cNum: { width: "13%", textAlign: "right" },
  totals: { alignSelf: "flex-end", width: "40%", marginTop: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grand: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  signs: { flexDirection: "row", gap: 12, marginTop: 28 },
  sign: { flex: 1, borderTopWidth: 0.5, borderTopColor: "#222", paddingTop: 4 },
});

export function PurchasePdf({ doc, labels, logo }: { doc: PurchaseDoc; labels: PurchasePdfLabels; logo: PdfLogo }) {
  return (
    <Document title={`${labels.title} ${doc.number}`}>
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          <View>
            {logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf, no un <img> del DOM
              <Image style={s.logo} src={logo} />
            ) : (
              <Text style={s.companyName}>{doc.companyName}</Text>
            )}
            {logo ? <Text style={s.label}>{doc.companyName}</Text> : null}
            {doc.companyLines.map((l) => (
              <Text key={l} style={s.muted}>
                {l}
              </Text>
            ))}
          </View>
          <View>
            <Text style={s.title}>
              {labels.title} {doc.number}
            </Text>
            <Text style={{ textAlign: "right" }}>
              {labels.date}: {formatDate(doc.date)}
            </Text>
            {doc.draft ? <Text style={s.draft}>{labels.draft}</Text> : null}
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.label}>{labels.supplier}</Text>
          <Text>{doc.supplierName}</Text>
          {doc.supplierLines.map((l) => (
            <Text key={l} style={s.muted}>
              {l}
            </Text>
          ))}
        </View>

        <View style={[s.row, s.head]}>
          <Text style={s.cSku}>{labels.sku}</Text>
          <Text style={s.cName}>{labels.product}</Text>
          <Text style={s.cNum}>{labels.qty}</Text>
          <Text style={s.cNum}>{labels.unitCost}</Text>
          <Text style={s.cNum}>{labels.taxPercent}</Text>
          <Text style={s.cNum}>{labels.lineTotal}</Text>
        </View>
        {doc.items.map((i, n) => (
          <View key={n} style={s.row} wrap={false}>
            <Text style={s.cSku}>{i.sku}</Text>
            <Text style={s.cName}>{i.name}</Text>
            <Text style={s.cNum}>{i.qty}</Text>
            <Text style={s.cNum}>{formatMoney(i.unitCost)}</Text>
            <Text style={s.cNum}>{i.taxRate}</Text>
            <Text style={s.cNum}>{formatMoney(i.total)}</Text>
          </View>
        ))}

        <View style={s.totals}>
          <View style={s.totalRow}>
            <Text>{labels.subtotal}</Text>
            <Text>{formatMoney(doc.subtotal)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text>{labels.tax}</Text>
            <Text>{formatMoney(doc.tax)}</Text>
          </View>
          <View style={[s.totalRow, s.grand]}>
            <Text>{labels.total}</Text>
            <Text>{formatMoney(doc.total)}</Text>
          </View>
        </View>

        {doc.note ? (
          <View style={s.section}>
            <Text style={s.label}>{labels.note}</Text>
            <Text>{doc.note}</Text>
          </View>
        ) : null}

        <View style={s.signs} wrap={false}>
          {doc.signatures.map((sig) => (
            <View key={sig.key} style={s.sign}>
              <Text style={s.label}>{labels.signatures[sig.key]}</Text>
              <Text>{sig.name ?? "—"}</Text>
              <Text style={s.muted}>{sig.name && sig.date ? formatDate(sig.date) : ""}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export function renderPurchasePdf(doc: PurchaseDoc, labels: PurchasePdfLabels, logo: PdfLogo): Promise<Buffer> {
  return renderToBuffer(<PurchasePdf doc={doc} labels={labels} logo={logo} />);
}
