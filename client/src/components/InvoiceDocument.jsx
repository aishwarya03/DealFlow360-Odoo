import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// A real, laid-out PDF (react-pdf's own layout engine — Yoga flexbox), not a
// screenshot of the on-screen preview. Fixes the two things browser
// print-to-PDF got wrong here: content clipped by the modal's scroll
// container, and no control over pagination if a line table runs long.
const BRAND = '#7C3AED'; // docs/DESIGN_SYSTEM.md's brand accent

// react-pdf's built-in "Helvetica"/"Times-Roman"/"Courier" base fonts are the
// PDF spec's 14 standard fonts — Latin-1 only, no ₹ (U+20B9) glyph, so it was
// silently dropping the currency symbol. Noto Sans does have that glyph
// (verified against its own font tables) and is bundled locally in
// public/fonts rather than fetched from a CDN, so PDF generation never
// depends on network access during a live demo.
Font.register({
  family: 'Noto Sans',
  fonts: [
    { src: '/fonts/NotoSans-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/NotoSans-Bold.ttf', fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: '#1E293B', fontFamily: 'Noto Sans' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  companyName: { fontSize: 15, fontWeight: 700, color: BRAND },
  muted: { color: '#94A3B8', fontSize: 9 },
  invoiceTitle: { fontSize: 20, fontWeight: 700, textAlign: 'right', letterSpacing: 1 },
  section: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  label: { fontSize: 8, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  value: { fontSize: 10, color: '#0F172A' },
  strong: { fontWeight: 700 },
  badge: {
    marginTop: 4,
    alignSelf: 'flex-end',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 3,
    fontSize: 8,
    fontWeight: 700,
  },
  table: { marginTop: 8, borderTop: '1 solid #E2E8F0' },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #E2E8F0',
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
  },
  tableRow: { flexDirection: 'row', borderBottom: '1 solid #F1F5F9', paddingVertical: 6 },
  th: { fontSize: 8, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.3 },
  colItem: { flex: 3 },
  colQty: { flex: 1, textAlign: 'right' },
  colPrice: { flex: 1.3, textAlign: 'right' },
  colDiscount: { flex: 1.5, textAlign: 'right' },
  colTax: { flex: 1, textAlign: 'right' },
  colAmount: { flex: 1.4, textAlign: 'right', fontWeight: 700 },
  totals: { marginTop: 16, alignItems: 'flex-end' },
  totalsBox: { width: 220 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  totalsRowFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: '1 solid #CBD5E1',
    marginTop: 4,
    paddingTop: 6,
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 40,
    right: 40,
    borderTop: '1 solid #E2E8F0',
    paddingTop: 10,
    fontSize: 8,
    color: '#94A3B8',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

const STATUS_COLORS = {
  PAID: { bg: '#DCFCE7', text: '#15803D' },
  UNPAID: { bg: '#FEF3C7', text: '#B45309' },
  OVERDUE: { bg: '#FEE2E2', text: '#B91C1C' },
};

const invoiceCode = (id) => `INV-${2000 + id}`;

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n ?? 0);

const oneTimeLineRows = (lines = []) =>
  lines
    .filter((line) => !line.isRecurring)
    .map((line) => {
      const gross = line.unitPrice * line.quantity;
      const discountAmount = gross * (line.discountPercent / 100);
      const net = gross - discountAmount;
      const tax = net * (line.taxRateAtEntry / 100);
      return { ...line, gross, discountAmount, net, tax, total: net + tax };
    });

/**
 * The actual downloadable invoice PDF — company branding, bill-to/delivery
 * address, order reference, full line-item breakdown (incl. discount), and
 * payment status/dates. Rendered on demand via @react-pdf/renderer's pdf()
 * (see InvoicePreviewModal's Download PDF button), not pre-generated or
 * stored — always reflects the current invoice/quotation record.
 */
const InvoiceDocument = ({ quotation }) => {
  const invoice = quotation.invoice;
  const lineRows = oneTimeLineRows(quotation.lines);
  const totalDiscount = lineRows.reduce((sum, line) => sum + line.discountAmount, 0);
  const statusKey = invoice.isOverdue ? 'OVERDUE' : invoice.status;
  const statusColor = STATUS_COLORS[statusKey] ?? STATUS_COLORS.UNPAID;

  return (
    <Document title={`${invoiceCode(invoice.id)} - ${quotation.customer.name}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>Netrix Systems Pvt Ltd</Text>
            <Text style={styles.muted}>Bengaluru, Karnataka, India</Text>
            <Text style={styles.muted}>Security & surveillance systems integrator</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={[styles.muted, { textAlign: 'right', marginTop: 2 }]}>{invoiceCode(invoice.id)}</Text>
            <Text
              style={[styles.badge, { backgroundColor: statusColor.bg, color: statusColor.text }]}
            >
              {statusKey}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={{ maxWidth: 260 }}>
            <Text style={styles.label}>Bill to</Text>
            <Text style={[styles.value, styles.strong]}>{quotation.customer.name}</Text>
            {quotation.customer.email && <Text style={styles.value}>{quotation.customer.email}</Text>}
            {quotation.customer.phone && <Text style={styles.value}>{quotation.customer.phone}</Text>}

            <Text style={[styles.label, { marginTop: 10 }]}>Delivery address</Text>
            <Text style={styles.value}>{quotation.customer.address || 'Not on file'}</Text>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.label}>Order reference</Text>
            <Text style={[styles.value, { marginBottom: 8 }]}>
              {quotation.code} · {quotation.owner.name}
            </Text>

            <Text style={styles.label}>Invoice date</Text>
            <Text style={[styles.value, { marginBottom: 8 }]}>
              {new Date(invoice.createdAt).toLocaleDateString('en-IN')}
            </Text>

            <Text style={styles.label}>Due date</Text>
            <Text style={styles.value}>{new Date(invoice.dueDate).toLocaleDateString('en-IN')}</Text>

            {quotation.deliveredAt && (
              <>
                <Text style={[styles.label, { marginTop: 8 }]}>Delivered on</Text>
                <Text style={styles.value}>{new Date(quotation.deliveredAt).toLocaleDateString('en-IN')}</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colItem]}>Item</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colPrice]}>Unit price</Text>
            <Text style={[styles.th, styles.colDiscount]}>Discount</Text>
            <Text style={[styles.th, styles.colTax]}>GST</Text>
            <Text style={[styles.th, styles.colAmount]}>Amount</Text>
          </View>

          {lineRows.map((line) => (
            <View key={line.id} style={styles.tableRow}>
              <Text style={[styles.value, styles.colItem]}>{line.product?.name ?? `#${line.productId}`}</Text>
              <Text style={[styles.value, styles.colQty]}>{line.quantity}</Text>
              <Text style={[styles.value, styles.colPrice]}>{fmt(line.unitPrice)}</Text>
              <Text style={[styles.value, styles.colDiscount]}>
                {line.discountPercent > 0 ? `${line.discountPercent}% (-${fmt(line.discountAmount)})` : '—'}
              </Text>
              <Text style={[styles.value, styles.colTax]}>{line.taxRateAtEntry}%</Text>
              <Text style={[styles.value, styles.colAmount]}>{fmt(line.total)}</Text>
            </View>
          ))}

          {lineRows.length === 0 && (
            <View style={styles.tableRow}>
              <Text style={[styles.muted, { flex: 1, textAlign: 'center' }]}>No one-time lines on this invoice.</Text>
            </View>
          )}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.muted}>Gross</Text>
              <Text style={styles.value}>{fmt(invoice.netAmount + totalDiscount)}</Text>
            </View>
            {totalDiscount > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.muted}>Discount</Text>
                <Text style={styles.value}>-{fmt(totalDiscount)}</Text>
              </View>
            )}
            <View style={styles.totalsRow}>
              <Text style={styles.muted}>Subtotal</Text>
              <Text style={styles.value}>{fmt(invoice.netAmount)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.muted}>GST</Text>
              <Text style={styles.value}>{fmt(invoice.taxAmount)}</Text>
            </View>
            <View style={styles.totalsRowFinal}>
              <Text style={[styles.value, styles.strong]}>Total due</Text>
              <Text style={[styles.value, styles.strong]}>{fmt(invoice.totalAmount)}</Text>
            </View>
          </View>
        </View>

        {invoice.status === 'PAID' && invoice.paidAt && (
          <Text style={{ marginTop: 10, textAlign: 'right', fontSize: 9, color: '#15803D' }}>
            Paid on {new Date(invoice.paidAt).toLocaleDateString('en-IN')}
          </Text>
        )}

        <View style={styles.footer} fixed>
          <Text>Payment terms: due within {Math.max(1, Math.round((new Date(invoice.dueDate) - new Date(invoice.createdAt)) / 86400000))} days of invoice date.</Text>
          <Text>Netrix Systems Pvt Ltd · Seller of record</Text>
        </View>
      </Page>
    </Document>
  );
};

export default InvoiceDocument;
