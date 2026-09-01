import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(40, 810, "OPAL CHAUFFEURS AUSTRALIA — MASTER OPERATIONS MANUAL")
            self.drawRightString(555, 810, "CONFIDENTIAL & PROPRIETARY")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(40, 804, 555, 804)
        
        # Footer
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(40, 45, 555, 45)
        
        self.setFont("Helvetica", 8)
        self.drawString(40, 32, "Opal Chauffeurs Australia Pty Ltd • www.opalchauffeurs.com.au • +61 432 000 718")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(555, 32, page_text)
        self.restoreState()

def build_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=40,
        rightMargin=40,
        topMargin=50,
        bottomMargin=55
    )

    styles = getSampleStyleSheet()
    
    # Custom Palette
    c_gold = colors.HexColor("#B45309")
    c_navy = colors.HexColor("#0F172A")
    c_dark = colors.HexColor("#1E293B")
    c_bg_light = colors.HexColor("#F8FAFC")
    c_border = colors.HexColor("#CBD5E1")

    # Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=c_navy,
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=c_gold,
        spaceAfter=12
    )

    h1_style = ParagraphStyle(
        'Header1',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=c_navy,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Header2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=c_gold,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=c_dark,
        spaceAfter=5
    )

    table_header = ParagraphStyle(
        'TH',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white
    )

    table_cell = ParagraphStyle(
        'TC',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10.5,
        textColor=c_dark
    )

    table_cell_bold = ParagraphStyle(
        'TCB',
        parent=table_cell,
        fontName='Helvetica-Bold'
    )

    box_text = ParagraphStyle(
        'BoxText',
        parent=body_style,
        fontSize=8,
        leading=11.5,
        textColor=c_dark
    )

    story = []

    # COVER / HEADER BANNER
    story.append(Paragraph("OPAL CHAUFFEURS AUSTRALIA", title_style))
    story.append(Paragraph("VIP FLEET OPERATIONS & DISPATCH PLATFORM — MASTER MANUAL", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=c_gold, spaceBefore=0, spaceAfter=10))

    meta_data = [
        [
            Paragraph("<b>Official Domain:</b> https://www.opalchauffeurs.com.au", body_style),
            Paragraph("<b>Director / Contact:</b> Sonu Tripathi (+61 432 000 718)", body_style)
        ],
        [
            Paragraph("<b>Live Platform URL:</b> https://driver-frontend-q3fh.onrender.com", body_style),
            Paragraph("<b>Driver Mobile App:</b> https://driver-frontend-q3fh.onrender.com/driver", body_style)
        ],
        [
            Paragraph("<b>Tax & Legal Entity:</b> Opal Chauffeurs Australia Pty Ltd", body_style),
            Paragraph("<b>Bank:</b> Commonwealth Bank (BSB: 063-000 • Acc: 1092 8841)", body_style)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[250, 265])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), c_bg_light),
        ('BOX', (0, 0), (-1, -1), 1, c_border),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 10))

    # SECTION 1: SYSTEM ARCHITECTURE & END-TO-END WORKFLOW
    story.append(Paragraph("1. System Architecture & End-to-End Operational Loop", h1_style))
    story.append(Paragraph(
        "Platform ka architecture 5 real-time interconnected stages par operate karta hai. Har booking live sync aur automated financial logic ke through circulate hoti hai:",
        body_style
    ))

    flow_data = [
        [
            Paragraph("<b>Stage 1: Booking & Quoting Entry</b>", table_cell_bold),
            Paragraph("Client website ya Instant 3D Quoting Engine par booking confirm karta hai. System instant booking ref (#CCM-2026-XXXX) generate karke <b>Phase 1 Booking Confirmation Voucher</b> (WhatsApp & Email) ready karta hai.", table_cell)
        ],
        [
            Paragraph("<b>Stage 2: Live Dispatch & Driver Allocation</b>", table_cell_bold),
            Paragraph("Admin Operate Board par driver (Sonu Tripathi, Daniel, Marcus) aur vehicle (Mercedes S-Class GTS783) assign karta hai. 1-click se driver ke WhatsApp par manifest aur secret Driver PWA link chala jata hai.", table_cell)
        ],
        [
            Paragraph("<b>Stage 3: Live Driver Execution & Telemetry</b>", table_cell_bold),
            Paragraph("Driver mobile PWA (/driver) par [En Route] -> [Arrived] -> [Passenger On Board] -> [Complete Trip] update karta hai. Dashboard par bina refresh kiye Chime Sound bajta hai aur live status sync hota hai.", table_cell)
        ],
        [
            Paragraph("<b>Stage 4: ATO 10% GST & Tax Invoicing</b>", table_cell_bold),
            Paragraph("Trip complete hote hi system Section 195-1 GST Act ke tahat 1/11th GST calculate karke <b>Official Tax Invoice (#INV-2026-XXXX)</b> banata hai aur <b>Phase 2 WhatsApp/Email Invoice</b> dispatch trigger karta hai.", table_cell)
        ],
        [
            Paragraph("<b>Stage 5: Monthly Corporate Ledger & Analytics</b>", table_cell_bold),
            Paragraph("Monthly Net-30 accounts (Rio Tinto, BHP, PwC) ka balance ledger me record hota hai. FIFO 1-click settlement aur RFC 4180 CSV exports instant download hote hain.", table_cell)
        ]
    ]
    flow_table = Table(flow_data, colWidths=[155, 360])
    flow_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [c_bg_light, colors.white]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(flow_table)
    story.append(Spacer(1, 10))

    # SECTION 2: 2-PHASE CLIENT COMMUNICATION PROTOCOL
    story.append(Paragraph("2. 2-Phase Luxury Client Messaging Protocol", h1_style))
    msg_data = [
        [
            Paragraph("<b>Phase 1: Booking Confirmation & Trip Voucher</b><br/><i>(Sent instantly when booking is confirmed)</i>", table_cell_bold),
            Paragraph("• Header: 🚗 [OPAL CHAUFFEURS - BOOKING CONFIRMATION & TRIP VOUCHER] 🧑‍✈️<br/>"
                      "• Content: Booking Ref, Lead Passenger, Date & Time AEST, Route, Reserved Vehicle Category, Allocated Lead Chauffeur Sonu Tripathi (+61 432 000 718).<br/>"
                      "• Note: Chauffeur arrival 10 mins prior. Live satellite flight tracking for airport meet & greet.<br/>"
                      "• Channels: 1-Click WhatsApp Voucher + 1-Click Email Voucher.", table_cell)
        ],
        [
            Paragraph("<b>Phase 2: Official ATO Tax Invoice</b><br/><i>(Sent after chauffeur completes the trip)</i>", table_cell_bold),
            Paragraph("• Header: 🧾 [OPAL CHAUFFEURS AUSTRALIA - OFFICIAL ATO TAX INVOICE] 🚘<br/>"
                      "• Content: Tax Invoice #INV-2026-XXXX, Booking Ref, Client/Corporate Entity, Journey Date & Route, Total Gross Fare ($ AUD), 10% Australian GST Breakdown ($1/11th).<br/>"
                      "• Remittance: Commonwealth Bank (BSB: 063-000, Acc: 1092 8841, PayID: accounts@opalchauffeurs.com.au).<br/>"
                      "• Channels: 1-Click WhatsApp Tax Invoice + 1-Click Email Invoice + Printable PDF.", table_cell)
        ]
    ]
    msg_table = Table(msg_data, colWidths=[175, 340])
    msg_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [c_bg_light, colors.white]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(msg_table)
    story.append(Spacer(1, 10))

    # Page Break for Module Breakdown
    story.append(PageBreak())

    # SECTION 3: PAGE-BY-PAGE & BUTTON-BY-BUTTON DIRECTORY
    story.append(Paragraph("3. Detailed Module & Button Reference Directory", h1_style))

    modules = [
        {
            "title": "A. Top Navigation Header",
            "desc": "Universal sticky header for real-time status and quick actions.",
            "buttons": [
                ("Live AEST Clock", "Melbourne Hub live local timezone indicator."),
                ("opalchauffeurs.com.au", "Official company website direct link."),
                ("Opal Cloud Engine [ LIVE ]", "Central Python FastAPI cloud server health indicator."),
                ("Admin [ FULL ACCESS ]", "Locked Master Director authorization badge for Sonu Tripathi."),
                ("Notification Bell (3)", "Displays pending unassigned urgent journeys and pings.")
            ]
        },
        {
            "title": "B. Executive Overview (/dashboard)",
            "desc": "Master analytics hub with 3D car visualizer and high-level KPIs.",
            "buttons": [
                ("Today's Gross Revenue Card", "Opens detailed Revenue Audit modal (Card, Bank, Pending)."),
                ("Net Operating Profit Card", "Opens Margin Breakdown modal (Driver payouts, Fuel, Company Net)."),
                ("Active Journeys Card", "Opens Live Trip Manifest audit modal."),
                ("Active Fleet Card", "Opens Chauffeur Availability and Rating Roster modal."),
                ("3D Vehicle Selector", "Interactive 360-degree rotation of Mercedes S-Class, V-Class, Sprinter.")
            ]
        },
        {
            "title": "C. Live Operate Board (/operate)",
            "desc": "Core dispatch command center for scheduling and allocating journeys.",
            "buttons": [
                ("+ Add New Ride", "Opens manual booking modal for custom phone/email reservations."),
                ("Assign Driver & Vehicle", "Opens Driver Allocation Modal (Sonu Tripathi / Mercedes GTS783)."),
                ("Dispatch WhatsApp Manifest", "Sends pre-formatted trip manifest & /driver link to chauffeur WhatsApp."),
                ("Filter: ALL / UNASSIGNED / ACTIVE", "Filters dispatch list by operational milestone status.")
            ]
        },
        {
            "title": "D. Instant 3D Quoting & Bookings (/quote)",
            "desc": "Customer-facing and admin instant quoting engine with 4 payment channels.",
            "buttons": [
                ("Vehicle Category Tabs", "Switches between Sedan, Executive, People Mover, Minibus, SUV."),
                ("Airport Meet & Greet Toggle", "Enables flight radar tracking and 60-min complimentary buffer."),
                ("Payment Channels (Card / OSKO / Wallet / Net-30)", "Selects payment gateway and calculates 10% GST."),
                ("Pay & Confirm Master Booking", "Authorizes payment, generates #CCM ref, chimes sound, opens Phase 1 voucher modal."),
                ("WhatsApp Voucher & Email Voucher", "Dispatches Phase 1 Booking Confirmation Voucher to client.")
            ]
        },
        {
            "title": "E. Driver Mobile PWA (/driver)",
            "desc": "Standalone mobile interface for chauffeurs on the road.",
            "buttons": [
                ("Start Navigation / En Route", "Updates trip status to EN_ROUTE and opens Google/Apple Maps."),
                ("Arrived at Pickup", "Updates status to ARRIVED and sends SMS arrival notification to passenger."),
                ("Passenger On Board", "Updates status to PICKED_UP and engages live meter."),
                ("Complete Trip", "Sets status to COMPLETED, settles driver payout, and triggers Tax Invoice auto-generation."),
                ("Call Passenger / WhatsApp Passenger", "Direct 1-tap communication with lead passenger.")
            ]
        },
        {
            "title": "F. Client & Customer Details (/clients)",
            "desc": "Complete client dossiers, booking histories, and 1-click invoice dispatch.",
            "buttons": [
                ("Dossier & Rides", "Opens complete customer dossier with VIP car preferences, notes, and full booking history."),
                ("WhatsApp Statement (Row)", "Sends total outstanding debt & Commonwealth Bank EFT remittance to client WhatsApp."),
                ("Email Statement (Row)", "Drafts official pre-filled statement to client accounts email."),
                ("Invoice Button (Inside Dossier)", "Opens full printable ATO-compliant Tax Invoice sheet modal."),
                ("+ Onboard Client / Corporate", "Opens modal to register new company (Rio Tinto, BHP) with custom credit limit.")
            ]
        },
        {
            "title": "G. GST Invoicing & Tax Remittance (/invoicing)",
            "desc": "ATO BAS Section 195-1 tax compliance and monthly post-paid debtor ledger.",
            "buttons": [
                ("View Monthly Accounts & Balances", "Opens Net-30 corporate directory with total debt ($5,730 AUD)."),
                ("Quick FIFO Settle", "Settles oldest unpaid invoices first upon receiving bank EFT transfer."),
                ("View Tax Invoice", "Opens official Tax Invoice modal for viewing, printing, or PDF download."),
                ("+ Create Manual Invoice", "Generates custom corporate tax invoice.")
            ]
        },
        {
            "title": "H. Profit Analytics & Reports (/analytics)",
            "desc": "Financial P&L reports, driver leaderboards, and RFC 4180 CSV exports.",
            "buttons": [
                ("Trip Profitability CSV", "Instantly downloads opal_trip_profitability_audit_2026.csv to device."),
                ("Financial Ledger CSV", "Instantly downloads opal_general_financial_ledger_2026.csv to device."),
                ("3-Color Bar Chart Tooltip", "Hover over any day to inspect Gross Revenue (Yellow), Fleet Cost (Red), Profit (Green)."),
                ("Low Margin Flags Card", "Opens Root-Cause Investigation modal (Tolls, waiting time, preventive measures).")
            ]
        }
    ]

    for m in modules:
        story.append(Paragraph(m["title"], h2_style))
        story.append(Paragraph(f"<i>{m['desc']}</i>", body_style))
        
        btn_rows = [
            [Paragraph("<b>Button / Control</b>", table_header), Paragraph("<b>Action & Operational Outcome</b>", table_header)]
        ]
        for b_name, b_action in m["buttons"]:
            btn_rows.append([Paragraph(b_name, table_cell_bold), Paragraph(b_action, table_cell)])
        
        btn_table = Table(btn_rows, colWidths=[150, 365])
        btn_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), c_navy),
            ('GRID', (0, 0), (-1, -1), 0.5, c_border),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [c_bg_light, colors.white]),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
            ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(btn_table)
        story.append(Spacer(1, 6))

    # Page Break for Live Status & Roadmap
    story.append(PageBreak())

    # SECTION 4: 100% LIVE READINESS VS FUTURE ROADMAP
    story.append(Paragraph("4. 100% Live Readiness Matrix & Future Integrations", h1_style))
    readiness_data = [
        [Paragraph("<b>Feature / Operational Capability</b>", table_header), Paragraph("<b>Current Status</b>", table_header), Paragraph("<b>Ready to Use Today?</b>", table_header)],
        [Paragraph("Opal Chauffeurs Rebranding & Official Domain Link", table_cell), Paragraph("🟢 100% Live", table_cell_bold), Paragraph("✅ Yes", table_cell_bold)],
        [Paragraph("Director Contact (+61 432 000 718) across system", table_cell), Paragraph("🟢 100% Live", table_cell_bold), Paragraph("✅ Yes", table_cell_bold)],
        [Paragraph("Client & Customer Details Directory & Dossiers", table_cell), Paragraph("🟢 100% Live", table_cell_bold), Paragraph("✅ Yes", table_cell_bold)],
        [Paragraph("1-Click WhatsApp & Email Invoicing Dispatch", table_cell), Paragraph("🟢 100% Live", table_cell_bold), Paragraph("✅ Yes", table_cell_bold)],
        [Paragraph("Phase 1 (Voucher) & Phase 2 (Tax Invoice) Messaging", table_cell), Paragraph("🟢 100% Live", table_cell_bold), Paragraph("✅ Yes", table_cell_bold)],
        [Paragraph("Standalone Chauffeur Mobile PWA (/driver)", table_cell), Paragraph("🟢 100% Live", table_cell_bold), Paragraph("✅ Yes", table_cell_bold)],
        [Paragraph("Real-Time Audio Chimes & Native Notifications", table_cell), Paragraph("🟢 100% Live", table_cell_bold), Paragraph("✅ Yes", table_cell_bold)],
        [Paragraph("ATO 10% GST Calculation & Printable Tax Invoices", table_cell), Paragraph("🟢 100% Live", table_cell_bold), Paragraph("✅ Yes", table_cell_bold)],
        [Paragraph("Monthly Net-30 Corporate FIFO Debt Settlement", table_cell), Paragraph("🟢 100% Live", table_cell_bold), Paragraph("✅ Yes", table_cell_bold)],
        [Paragraph("Excel / CSV Direct Spreadsheet File Downloads", table_cell), Paragraph("🟢 100% Live", table_cell_bold), Paragraph("✅ Yes", table_cell_bold)],
        [Paragraph("3D Interactive Luxury Car Visualizer", table_cell), Paragraph("🟢 100% Live", table_cell_bold), Paragraph("✅ Yes", table_cell_bold)],
        [Paragraph("Existing Website Booking Form Webhook", table_cell), Paragraph("🟡 API Ready (1-line embed)", table_cell), Paragraph("Optional Setup", table_cell)],
        [Paragraph("Meta / Twilio Silent WhatsApp API", table_cell), Paragraph("🟡 Hooks Ready in Backend", table_cell), Paragraph("Optional Setup", table_cell)],
    ]
    ready_table = Table(readiness_data, colWidths=[255, 150, 110])
    ready_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_navy),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [c_bg_light, colors.white]),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(ready_table)
    story.append(Spacer(1, 10))

    # Sign-off box
    sign_off = [
        [
            Paragraph(
                "<b>OPERATIONAL CERTIFICATION:</b><br/>"
                "This document certifies that the Opal Chauffeurs VIP Transport Operations Platform is fully configured, branded, tested, and actively deployed. All calculations adhere to Australian taxation laws (GST Act 1999) and executive VIP chauffeur hospitality standards.<br/><br/>"
                "<b>Director:</b> Sonu Tripathi &nbsp;&nbsp;•&nbsp;&nbsp; <b>Entity:</b> Opal Chauffeurs Australia Pty Ltd &nbsp;&nbsp;•&nbsp;&nbsp; <b>Date:</b> September 2026",
                box_text
            )
        ]
    ]
    sign_table = Table(sign_off, colWidths=[515])
    sign_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#FEF3C7")),
        ('BOX', (0, 0), (-1, -1), 1, c_gold),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(sign_table)

    # Build Document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF Successfully generated at: {filename}")

if __name__ == "__main__":
    out_path = os.path.join(os.getcwd(), "Opal_Chauffeurs_Master_Operations_Manual_2026.pdf")
    build_pdf(out_path)
