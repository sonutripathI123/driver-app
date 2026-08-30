import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, letter[1] - 36, "CROWN CHAUFFEURS OPERATIONS PLATFORM — COMPLETE HINGLISH GUIDE BOOK")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, letter[1] - 42, letter[0] - 54, letter[1] - 42)
            
        # Footer
        footer_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(letter[0] - 54, 36, footer_text)
        self.drawString(54, 36, "CONFIDENTIAL — ENTERPRISE CHAUFFEURS OPERATIONS PLATFORM (2026)")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, 48, letter[0] - 54, 48)
        
        self.restoreState()

def generate_guide_pdf(filename="Crown_Chauffeurs_Platform_Master_Guide_Book_Hinglish.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    # Custom Palette
    primary = colors.HexColor("#0F172A")    # Slate 900
    accent_gold = colors.HexColor("#B45309")# Amber 700
    accent_blue = colors.HexColor("#0369A1")# Sky 700
    accent_green = colors.HexColor("#047857")# Emerald 700
    text_dark = colors.HexColor("#1E293B")  # Slate 800
    bg_light = colors.HexColor("#F8FAFC")   # Slate 50
    border_color = colors.HexColor("#E2E8F0")

    # Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=primary,
        alignment=1, # Center
        spaceAfter=8
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=accent_gold,
        alignment=1,
        spaceAfter=15
    )

    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#64748B"),
        alignment=1,
        spaceAfter=25
    )
    
    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=primary,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )
    
    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=accent_blue,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=text_dark,
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=text_dark,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=3
    )
    
    table_text = ParagraphStyle(
        'TableText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=text_dark
    )

    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white
    )

    story = []
    
    # Title Block
    story.append(Paragraph("CROWN CHAUFFEURS OPERATIONS PLATFORM", title_style))
    story.append(Paragraph("COMPLETE MASTER GUIDE BOOK (HINGLISH EDITION)", subtitle_style))
    story.append(Paragraph("Version 2.0 &bull; Production Reference Manual &bull; All Features, Buttons & Automation Rules", meta_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=accent_gold, spaceBefore=0, spaceAfter=15))

    # Section 1: Introduction
    story.append(Paragraph("1. System Introduction & Architecture Overview", h1_style))
    story.append(Paragraph(
        "Crown Chauffeurs Platform ek high-end <b>Enterprise Chauffeur Dispatch & Fleet Operations Engine</b> hai. "
        "Ye platform luxury transfers, corporate accounts, wedding fleets, airport VIP meet-and-greet transfers aur "
        "driver payouts ko automated tareeqe se manage karta hai.",
        body_style
    ))
    story.append(Paragraph("&bull; <b>Frontend Engine:</b> React 18 + TypeScript + Vite + Three.js 3D Luxury Car Canvases + TailwindCSS.", bullet_style))
    story.append(Paragraph("&bull; <b>Backend API Engine:</b> Python 3.12+ + FastAPI + SQLAlchemy 2.0 (Async) + Pydantic v2.", bullet_style))
    story.append(Paragraph("&bull; <b>Cloud Deployment:</b> Render Cloud (Decoupled Static CDN + High-Performance Python Backend).", bullet_style))
    story.append(Paragraph("&bull; <b>Multi-Channel Alerts:</b> 1-Click WhatsApp Direct Dispatch + Google FCM VAPID Web Push + Web Audio Chime Synthesizer.", bullet_style))
    story.append(Spacer(1, 10))

    # Section 2: All 9 Modules
    story.append(Paragraph("2. All 9 Modules & Complete Button Directory", h1_style))
    
    # Module 1
    story.append(Paragraph("Module 1: Executive Overview (<code>/</code>)", h2_style))
    story.append(Paragraph("Business ka 360-degree executive snapshot jahan live KPIs (Today's Bookings, Active Drivers, Total Revenue in AUD) aur 3D luxury car display hoti hai.", body_style))

    # Module 2
    story.append(Paragraph("Module 2: Live Operate Board (<code>/operate</code>)", h2_style))
    story.append(Paragraph("Dispatcher ka main control room jahan saari rides 3 columns (PENDING, ALLOCATED, IN PROGRESS) me manage hoti hain.", body_style))
    
    operate_data = [
        [Paragraph("Button / Control", table_header), Paragraph("Feature & Operational Action", table_header)],
        [Paragraph("<b>Allocate Driver ➔</b>", table_text), Paragraph("Modal open karta hai jisme Driver aur Vehicle select karke Driver Payout ($ AUD) set hota hai. Overlapping schedule conflict auto-check hota hai.", table_text)],
        [Paragraph("<b>Offload to Partner ➔</b>", table_text), Paragraph("Agar internal fleet busy ho, to certified B2B Subcontractor Partner ko ride transfer karta hai fixed margin lock karke.", table_text)],
        [Paragraph("<b>Filter & Search Bar</b>", table_text), Paragraph("Passenger ke naam, phone, booking number (#CCM-XXXXX) ya vehicle class se instant filter karta hai.", table_text)],
        [Paragraph("<b>Cancel Booking</b>", table_text), Paragraph("Booking cancel karta hai aur Cancellation Circuit Breaker trigger karke automated customer reminders stop kar deta hai.", table_text)]
    ]
    t_operate = Table(operate_data, colWidths=[2.0*inch, 4.8*inch])
    t_operate.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [bg_light, colors.white]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_operate)
    story.append(Spacer(1, 10))

    # Module 3
    story.append(Paragraph("Module 3: Instant 3D Quoting & Booking (<code>/quotes</code>)", h2_style))
    story.append(Paragraph("3D WebGL car preview ke sath instant luxury quote calculate karne aur booking confirm karne ka module.", body_style))
    
    quote_data = [
        [Paragraph("Button / Control", table_header), Paragraph("Feature & Operational Action", table_header)],
        [Paragraph("<b>Vehicle Category 3D</b>", table_text), Paragraph("Executive Sedan, Premium Sedan, SUV, ya Minibus choose karein (3D model real-time change hota hai).", table_text)],
        [Paragraph("<b>Airport Meet Toggle</b>", table_text), Paragraph("Flight number input open karta hai aur $22.73 airport toll + 60m parking wait buffer auto-add karta hai.", table_text)],
        [Paragraph("<b>Pay Full vs 25% Deposit</b>", table_text), Paragraph("100% full payment ya 25% deposit choose karein (baaki 75% balance milestone tracking me jata hai).", table_text)],
        [Paragraph("<b>Confirm Instant Transfer</b>", table_text), Paragraph("Master Booking (#CCM-XXXXX) lock karta hai aur confetti celebration animation blast karta hai.", table_text)],
        [Paragraph("<b>📱 Open in WhatsApp ➔</b>", table_text), Paragraph("Confirmation modal par aane wala green action button jo 1 tap me formatted card WhatsApp par open karta hai.", table_text)]
    ]
    t_quote = Table(quote_data, colWidths=[2.0*inch, 4.8*inch])
    t_quote.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [bg_light, colors.white]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_quote)
    story.append(Spacer(1, 10))

    # Module 4
    story.append(Paragraph("Module 4: Driver Mobile PWA (<code>/driver-portal</code>)", h2_style))
    story.append(Paragraph("Chauffeur ke phone ke liye dedicated mobile portal. Passenger ka total customer fare confidential shielded rehta hai (driver ko sirf apna approved payout dikhta hai).", body_style))
    story.append(Paragraph("&bull; <b>1. En Route Button:</b> Driver jab pickup ke liye rawana hota hai (Ops & Manager ko notify karta hai).", bullet_style))
    story.append(Paragraph("&bull; <b>2. Arrived Button:</b> Driver location par pahunchte hi passenger ko automated SMS bhejta hai.", bullet_style))
    story.append(Paragraph("&bull; <b>3. Picked Up Button:</b> Passenger gaadi me baithne par ride ko live status me lock karta hai.", bullet_style))
    story.append(Paragraph("&bull; <b>4. Completed Button:</b> Destination par dropoff finish hote hi driver earnings account me payout credit karta hai.", bullet_style))
    story.append(Spacer(1, 10))

    # Module 5
    story.append(Paragraph("Module 5: Mobile Alert Hub & Notifications (<code>/notifications</code>)", h2_style))
    story.append(Paragraph("Owner/Manager mobile notification center jisme 6 operational trigger rules configure hain:", body_style))
    
    notif_rules = [
        [Paragraph("Trigger Rule", table_header), Paragraph("Dispatch Event & Schedule", table_header)],
        [Paragraph("<b>New Booking Alert</b>", table_text), Paragraph("Customer booking create aur payment confirm hote hi instant alert with route, fare ($ AUD).", table_text)],
        [Paragraph("<b>Driver Allocated Alert</b>", table_text), Paragraph("Dispatcher jaise hi driver aur car assign karega, payout rate ke sath instant ping.", table_text)],
        [Paragraph("<b>Trip Milestones Alert</b>", table_text), Paragraph("Driver ke En Route, Arrived, Picked Up, aur Completed buttons tap karne par live status updates.", table_text)],
        [Paragraph("<b>Flight Delay Alert</b>", table_text), Paragraph("FlightAware radar par 15+ min delay aane par auto-rescheduled time ka alert.", table_text)],
        [Paragraph("<b>Urgent Unassigned Alert</b>", table_text), Paragraph("Pickup se 4 ghante pehle tak job unassigned rehne par high-priority red alert.", table_text)],
        [Paragraph("<b>12-24h Reconfirmation</b>", table_text), Paragraph("Midnight-8am trips: 10am day prior. 8am-Midnight trips: 2pm (14:00) day prior.", table_text)]
    ]
    t_notif = Table(notif_rules, colWidths=[2.0*inch, 4.8*inch])
    t_notif.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [bg_light, colors.white]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_notif)
    story.append(Spacer(1, 10))

    # Other Modules
    story.append(Paragraph("Module 6 to 9: Airport Radar, Fleet, Invoicing & Analytics", h2_style))
    story.append(Paragraph("&bull; <b>Airport Flight Radar (/flights):</b> Commercial flights (QF400, EK408) aur private jets ka live radar tracking aur terminal gate instructions.", bullet_style))
    story.append(Paragraph("&bull; <b>Partner Network & Fleet (/partners):</b> Internal vehicles roster, licenses, background compliance aur partner offloading.", bullet_style))
    story.append(Paragraph("&bull; <b>GST Invoicing (/invoicing):</b> ATO 1/11th Tax Invoices (INV-2026-XXXX) aur First-In First-Out (FIFO) corporate debt clearing.", bullet_style))
    story.append(Paragraph("&bull; <b>Profit Analytics (/analytics):</b> Gross Revenue, Fleet Costs, Net Margin (+60%), aur Driver Performance KPIs.", bullet_style))
    story.append(Spacer(1, 10))

    # Section 3: Automated Cron Engines
    story.append(Paragraph("3. Automated Background Cron Engines (24/7 Scheduling)", h1_style))
    story.append(Paragraph("Platform me 5 automated background engines continuous chalte hain:", body_style))
    story.append(Paragraph("1. <b>7/5/3-Day Balance Chasing Engine:</b> Outstanding payment ke liye pickup date se 7 din, 5 din aur 3 din pehle reminder bhejta hai.", bullet_style))
    story.append(Paragraph("2. <b>12-24h Customer Pre-Trip Reconfirmation:</b> Midnight-8am rides ko 10am aur 8am-Midnight rides ko 2pm par reconfirmation deliver karta hai.", bullet_style))
    story.append(Paragraph("3. <b>2-Hour Chauffeur Handover Package:</b> Pickup se theek 2 ghante pehle passenger ko driver ka naam, contact aur car plate bhejta hai.", bullet_style))
    story.append(Paragraph("4. <b>Cancellation Circuit Breaker:</b> Booking cancel hone par saari scheduled marketing/reminders emails instant freeze kar deta hai.", bullet_style))
    story.append(Spacer(1, 10))

    # Section 4: Live URLs & Cheatsheet
    story.append(Paragraph("4. Live URLs & Deployment Cheatsheet", h1_style))
    story.append(Paragraph("&bull; <b>Live Frontend Web Dashboard:</b> https://driver-frontend-q3fh.onrender.com", bullet_style))
    story.append(Paragraph("&bull; <b>Live Backend API Engine:</b> https://driver-app-jj01.onrender.com/docs", bullet_style))
    story.append(Paragraph("&bull; <b>GitHub Safe Code Repository:</b> https://github.com/sonutripathI123/driver-app.git", bullet_style))
    story.append(Paragraph("&bull; <b>Manager Target Phone:</b> +91 9305365420 / +91 9385365428", bullet_style))
    
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully generated: {filename}")

if __name__ == "__main__":
    generate_guide_pdf()
