import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { getCurrencySymbol } from '../lib/currencies';

const styles = StyleSheet.create({
  page: { padding: 42, fontFamily: 'Helvetica', fontSize: 11, color: '#27272a', backgroundColor: '#ffffff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: 24, marginBottom: 32 },
  logo: { width: 64, height: 64, objectFit: 'contain', marginBottom: 10 },
  brand: { fontSize: 22, fontWeight: 'bold', color: '#0f766e', marginBottom: 5 },
  titleBlock: { alignItems: 'flex-end' },
  title: { fontSize: 24, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase', color: '#18181b' },
  muted: { color: '#71717a', lineHeight: 1.5 },
  panel: { borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 14, padding: 18, marginBottom: 22 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 20 },
  label: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.4, color: '#a1a1aa', marginBottom: 6, fontWeight: 'bold' },
  client: { fontSize: 15, fontWeight: 'bold', color: '#18181b', marginBottom: 3 },
  total: { fontSize: 26, fontWeight: 'bold', color: '#18181b' },
  table: { marginTop: 10, marginBottom: 18 },
  tableHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#d4d4d8', paddingBottom: 8, marginBottom: 4 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f4f4f5', paddingVertical: 9 },
  desc: { flex: 4 },
  qty: { flex: 1, textAlign: 'right' },
  rate: { flex: 1.4, textAlign: 'right' },
  amount: { flex: 1.4, textAlign: 'right' },
  totals: { alignItems: 'flex-end', marginTop: 6 },
  totalRow: { width: 210, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  grandRow: { width: 210, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: '#d4d4d8' },
  notes: { marginTop: 20, padding: 16, borderRadius: 12, backgroundColor: '#f8fafc', color: '#52525b', lineHeight: 1.55 },
  signatureImage: { width: 170, height: 60, objectFit: 'contain', marginBottom: 4 },
  footer: { position: 'absolute', left: 42, right: 42, bottom: 28, color: '#a1a1aa', fontSize: 9, textAlign: 'center' },
});

interface QuotePDFProps {
  quote: any;
  contractor: any;
  lineItems: any[];
  contractorVatNumber?: string;
  contractorRegNumber?: string;
  clientVatNumber?: string;
}

export function QuotePDF({ quote, contractor, lineItems, contractorVatNumber, contractorRegNumber, clientVatNumber }: QuotePDFProps) {
  const currency = quote.currency || contractor?.defaultCurrency || 'ZAR';
  const symbol = getCurrencySymbol(currency);
  const isSATaxInvoice = currency === 'ZAR' && quote.isSATaxInvoice;
  const vatNumber = contractorVatNumber || contractor?.vatNumber;
  const subtotal = quote.subtotal ?? lineItems.reduce((sum, item) => {
    const qty = Number(item.qty) || 0;
    const unitCost = Number(item.unitCost) || 0;
    const markup = item.type === 'material' ? (Number(item.markupPercent) || 0) : (Number(item.markupPercent) || 0);
    return sum + qty * unitCost * (1 + markup / 100);
  }, 0);
  const taxAmount = quote.taxAmount ?? 0;
  const total = quote.total ?? subtotal + taxAmount;
  const formatMoney = (value: number) => `${symbol}${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {quote.contractorLogoUrl || contractor?.logoUrl ? <Image src={quote.contractorLogoUrl || contractor?.logoUrl} style={styles.logo} /> : null}
            <Text style={styles.brand}>{quote.contractorBusinessName || contractor?.businessName || 'SoloBid'}</Text>
            {isSATaxInvoice && contractor?.vatNumber ? <Text style={styles.muted}>VAT No: {contractor.vatNumber}</Text> : null}
          </View>
          {isSATaxInvoice && (contractorRegNumber || contractor?.businessRegistrationNumber) ? <Text style={styles.muted}>Reg No: {contractorRegNumber || contractor?.businessRegistrationNumber}</Text> : null}
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{isSATaxInvoice ? 'TAX INVOICE (QUOTE)' : 'Quotation'}</Text>
            <Text style={styles.muted}>#{(quote.id || '').substring(0, 8).toUpperCase()}</Text>
            <Text style={styles.muted}>{new Date(quote.updatedAt || quote.createdAt || Date.now()).toLocaleDateString()}</Text>
            {quote.expiresAt ? <Text style={styles.muted}>Valid until {new Date(quote.expiresAt).toLocaleDateString()}</Text> : null}
          </View>
        </View>

        <View style={[styles.panel, styles.row]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Prepared for</Text>
            <Text style={styles.client}>{quote.clientName}</Text>
            <Text style={styles.muted}>{quote.clientEmail}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.label}>Total amount</Text>
            <Text style={styles.total}>{formatMoney(total)}</Text>
            <Text style={styles.muted}>Inclusive of {isSATaxInvoice ? '15% VAT' : `${quote.taxRate || 0}% tax`}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.desc, styles.label]}>Description</Text>
            <Text style={[styles.qty, styles.label]}>Qty</Text>
            <Text style={[styles.rate, styles.label]}>Rate</Text>
            <Text style={[styles.amount, styles.label]}>Amount</Text>
          </View>
          {lineItems.map((item, index) => {
            const qty = Number(item.qty) || 0;
            const unitCost = Number(item.unitCost) || 0;
            const markup = Number(item.markupPercent) || 0;
            const lineTotal = qty * unitCost * (1 + markup / 100);
            return (
              <View key={`${item.id || index}`} style={styles.tableRow}>
                <Text style={styles.desc}>{item.description}</Text>
                <Text style={styles.qty}>{qty}</Text>
                <Text style={styles.rate}>{formatMoney(unitCost)}</Text>
                <Text style={styles.amount}>{formatMoney(lineTotal)}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}><Text>Subtotal</Text><Text>{formatMoney(subtotal)}</Text></View>
          <View style={styles.totalRow}><Text>{isSATaxInvoice ? 'VAT' : 'Tax'}</Text><Text>{formatMoney(taxAmount)}</Text></View>
          <View style={styles.grandRow}><Text style={{ fontWeight: 'bold' }}>Total</Text><Text style={{ fontWeight: 'bold' }}>{formatMoney(total)}</Text></View>
        </View>

        {quote.notes || contractor?.terms ? <Text style={styles.notes}>{quote.notes || contractor?.terms}</Text> : null}
        {quote.signatureDataUrl ? (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.label}>Client approval</Text>
            <Image src={quote.signatureDataUrl} style={styles.signatureImage} />
            <Text style={styles.muted}>Signed by {quote.signatureName} on {new Date(quote.approvedAt).toLocaleString()}</Text>
          </View>
        ) : null}
        {isSATaxInvoice && vatNumber ? (
          <Text style={[styles.footer, { bottom: 44 }]}>VAT Reg: {vatNumber} | Tax Invoice issued in terms of Section 20(4) of the VAT Act No. 89 of 1991</Text>
        ) : null}
        <Text style={styles.footer}>Generated by SoloBid — professional quoting for South African service businesses.</Text>
      </Page>
    </Document>
  );
}
