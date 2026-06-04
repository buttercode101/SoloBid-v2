import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Register fonts
Font.register({
  family: 'Roboto',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf',
});
Font.register({
  family: 'OpenSans',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf',
});

import { getCurrencySymbol } from '../lib/currencies';

const createStyles = (fontFamily: string, style: string) => StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: fontFamily === 'Helvetica' ? 'Helvetica' : fontFamily === 'Times-Roman' ? 'Times-Roman' : fontFamily === 'Courier' ? 'Courier' : 'Helvetica',
    fontSize: 12,
    color: '#333',
  },
  header: {
    flexDirection: style === 'classic' ? 'column' : 'row',
    justifyContent: 'space-between',
    alignItems: style === 'classic' ? 'center' : 'flex-start',
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
    objectFit: 'contain',
    marginBottom: style === 'classic' ? 10 : 0,
  },
  businessInfo: {
    flexDirection: 'column',
    alignItems: style === 'classic' ? 'center' : 'flex-end',
  },
  businessName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  invoiceDetails: {
    flexDirection: 'column',
    alignItems: style === 'classic' ? 'center' : 'flex-end',
    color: '#666',
  },
  clientSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  clientName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  table: {
    width: '100%',
    marginBottom: 30,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
    marginBottom: 8,
  },
  colDesc: { flex: 4 },
  colQty: { flex: 1, textAlign: 'right' },
  colRate: { flex: 1, textAlign: 'right' },
  colTotal: { flex: 1, textAlign: 'right' },
  tableHeaderCell: {
    fontSize: 10,
    color: '#666',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  summary: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    marginTop: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
    width: 200,
  },
  summaryLabel: {
    flex: 1,
    color: '#666',
  },
  summaryValue: {
    flex: 1,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    width: 200,
  },
  totalLabel: {
    flex: 1,
    fontWeight: 'bold',
    fontSize: 14,
  },
  totalValue: {
    flex: 1,
    textAlign: 'right',
    fontWeight: 'bold',
    fontSize: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
  },
  notes: {
    fontSize: 10,
    color: '#666',
    marginBottom: 20,
  },
  signature: {
    marginTop: 40,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
    width: 200,
  },
  signatureText: {
    fontSize: 10,
    color: '#666',
  }
});

interface InvoicePDFProps {
  invoice: any;
  estimate: any;
  contractor: any;
  lineItems: any[];
  companyDetails?: {
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    registrationNumber?: string;
    bankDetails?: {
      accountName?: string;
      accountNumber?: string;
      bankName?: string;
      swiftCode?: string;
    };
  };
}

export const InvoicePDF: React.FC<InvoicePDFProps> = ({ invoice, estimate, contractor, lineItems, companyDetails }) => {
  const styles = createStyles(contractor?.pdfFont || 'Helvetica', contractor?.pdfStyle || 'modern');
  const currency = invoice.currency || estimate?.currency || contractor?.defaultCurrency || 'ZAR';
  const currencySymbol = getCurrencySymbol(currency);
  const isSATaxInvoice = currency === 'ZAR' && contractor?.saTaxInvoiceMode;
  const title = isSATaxInvoice ? 'Tax Invoice' : 'Invoice';
  
  return (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          {contractor?.logoUrl ? (
            <Image src={contractor.logoUrl} style={styles.logo} />
          ) : (
            <Text style={styles.businessName}>{contractor?.businessName}</Text>
          )}
          {isSATaxInvoice && contractor?.vatNumber && (
            <Text style={{ fontSize: 10, color: '#666', marginTop: 4 }}>VAT No: {contractor.vatNumber}</Text>
          )}
        </View>
        <View style={styles.businessInfo}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.invoiceDetails}>
            <Text>Invoice #: {invoice.invoiceNumber || invoice.id.substring(0, 8).toUpperCase()}</Text>
            <Text>Date: {new Date(invoice.createdAt).toLocaleDateString()}</Text>
            <Text>Due Date: {new Date(invoice.dueDate).toLocaleDateString()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.clientSection}>
        <Text style={styles.sectionTitle}>Bill To</Text>
        <Text style={styles.clientName}>{invoice.clientName}</Text>
        <Text>{invoice.clientEmail}</Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.colDesc, styles.tableHeaderCell]}>Description</Text>
          <Text style={[styles.colQty, styles.tableHeaderCell]}>Qty</Text>
          <Text style={[styles.colRate, styles.tableHeaderCell]}>Rate</Text>
          <Text style={[styles.colTotal, styles.tableHeaderCell]}>Total</Text>
        </View>
        
        {lineItems.map((item, i) => {
          const baseCost = item.qty * item.unitCost;
          const markup = item.type === 'material' ? baseCost * (item.markupPercent / 100) : 0;
          const lineTotal = baseCost + markup;
          
          return (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.qty}</Text>
              <Text style={styles.colRate}>{currencySymbol}{item.unitCost.toFixed(2)}</Text>
              <Text style={styles.colTotal}>{currencySymbol}{lineTotal.toFixed(2)}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{currencySymbol}{(estimate?.subtotal || 0).toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{isSATaxInvoice ? 'VAT (15%)' : `Tax (${estimate?.taxRate || 0}%)`}</Text>
          <Text style={styles.summaryValue}>{currencySymbol}{(estimate?.taxAmount || 0).toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{currencySymbol}{(invoice.total || 0).toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        {contractor?.terms && (
          <View style={styles.notes}>
            <Text style={styles.sectionTitle}>Terms & Conditions</Text>
            <Text>{contractor.terms}</Text>
          </View>
        )}
        
        {estimate?.signatureName && (
          <View style={styles.signature}>
            <Text>Approved by: {estimate.signatureName}</Text>
            <Text style={styles.signatureText}>Date: {new Date(estimate.approvedAt).toLocaleDateString()}</Text>
          </View>
        )}

        <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 10, color: '#666' }}>{contractor?.businessName}</Text>
          {contractor?.phone && <Text style={{ fontSize: 10, color: '#666' }}>Phone: {contractor.phone}</Text>}
          <Text style={{ fontSize: 10, color: '#666' }}>{contractor?.email}</Text>
        </View>

        <View style={{ marginTop: 10 }}>
          {companyDetails?.address && (
            <Text style={{ fontSize: 9, color: '#666' }}>
              {companyDetails.address}
            </Text>
          )}
          {companyDetails?.bankDetails && (
            <Text style={{ fontSize: 9, color: '#666', marginTop: 8 }}>
              Bank: {companyDetails.bankDetails.bankName} | Account Name: {companyDetails.bankDetails.accountName} | Account: {companyDetails.bankDetails.accountNumber}
            </Text>
          )}
          {companyDetails?.registrationNumber && (
            <Text style={{ fontSize: 9, color: '#666', marginTop: 4 }}>
              Reg #: {companyDetails.registrationNumber}
            </Text>
          )}
        </View>
      </View>
    </Page>
  </Document>
)};
