import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
    HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
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
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 11 * 72 - 36, "ENTERPRISE CHAUFFEUR OPERATIONS PLATFORM — COMPLETE SYSTEM MANUAL")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, 11 * 72 - 42, 8.5 * 72 - 54, 11 * 72 - 42)
            
        # Footer
        footer_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * 72 - 54, 36, footer_text)
        self.drawString(54, 36, "CONFIDENTIAL & PROPRIETARY — OPERATIONAL ARCHITECTURE & BUTTON DIRECTORY")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, 46, 8.5 * 72 - 54, 46)
        
        self.restoreState()

def generate_manual_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom Brand Palette
    c_primary = colors.HexColor("#0F172A")    # Deep Slate / Obsidian
    c_gold = colors.HexColor("#B45309")       # Amber / Gold Accent
    c_cyan = colors.HexColor("#0284C7")       # Cyan / Blue
    c_emerald = colors.HexColor("#047857")    # Emerald Green
    c_dark = colors.HexColor("#1E293B")       # Text dark
    c_muted = colors.HexColor("#64748B")      # Text muted
    c_bg_light = colors.HexColor("#F8FAFC")   # Light background
    c_border = colors.HexColor("#E2E8F0")

    # Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=c_primary,
        alignment=0,
        spaceAfter=6
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=c_gold,
        alignment=0,
        spaceAfter=15
    )

    h1_style = ParagraphStyle(
        'SectionH1',
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=c_primary,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=c_cyan,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyDark',
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=c_dark,
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'BulletItem',
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=c_dark,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=c_dark
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=c_primary
    )

    story = []

    # ==================== COVER / HEADER ====================
    story.append(Paragraph("ENTERPRISE CHAUFFEUR OPERATIONS PLATFORM", title_style))
    story.append(Paragraph("COMPLETE SYSTEM MANUAL, FEATURE GUIDE & BUTTON DIRECTORY", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=c_gold, spaceAfter=12))
    
    story.append(Paragraph(
        "<b>Architectural Mandate:</b> <i>ONE BOOKING → ONE RECORD → ONE SOURCE OF TRUTH</i><br/>"
        "This master documentation manual provides an exhaustive, granular directory of every visual button, user interface interaction, "
        "background mathematical algorithm, automated lifecycle state transition, and role-based operational gate across the entire "
        "Enterprise Chauffeur Platform (Backend Engine + 3D Luxury Frontend Dashboard Suite).",
        body_style
    ))
    story.append(Spacer(1, 10))

    # ==================== SECTION 1: GLOBAL NAVIGATION & TOP BAR ====================
    story.append(Paragraph("1. Global Navigation Bar & Top Header Controls", h1_style))
    story.append(Paragraph("Located persistently across all pages to provide real-time telemetry, session controls, and navigation.", body_style))

    header_buttons_data = [
        [Paragraph("UI Control / Button", table_header_style), Paragraph("Type / Trigger", table_header_style), Paragraph("Functional Behavior & Core Logic", table_header_style)],
        [
            Paragraph("<b>Mobile Menu Hamburger</b>", table_cell_bold),
            Paragraph("Touch / Click Icon", table_cell_style),
            Paragraph("Opens slide-out mobile navigation drawer on smartphones with smooth backdrop blur. Auto-closes upon destination selection.", table_cell_style)
        ],
        [
            Paragraph("<b>Melbourne Hub Telemetry</b>", table_cell_bold),
            Paragraph("Live Real-Time Widget", table_cell_style),
            Paragraph("Displays active Australian Eastern Standard Time (AEST) with real-time second sweep, synchronizing Melbourne airport flight curfew gates.", table_cell_style)
        ],
        [
            Paragraph("<b>FastAPI 2.0 Engine Pill</b>", table_cell_bold),
            Paragraph("System Status Badge", table_cell_style),
            Paragraph("Monitors async engine health, rate limiter status, database connection pools, and real-time backend latency.", table_cell_style)
        ],
        [
            Paragraph("<b>RBAC Persona Switcher</b>", table_cell_bold),
            Paragraph("Interactive Dropdown (6 Roles)", table_cell_style),
            Paragraph("Dynamically hot-swaps active session between <b>Admin, Operations Lead, Live Dispatcher, Accountant, Driver,</b> and <b>Corporate Client</b> with instant permission re-scoping.", table_cell_style)
        ],
        [
            Paragraph("<b>Notifications Bell (3)</b>", table_cell_bold),
            Paragraph("Alert Drawer Trigger", table_cell_style),
            Paragraph("Pulls high-priority operational alerts including flight delay reschedules, negative margin warnings, and pending balance chasing.", table_cell_style)
        ],
    ]

    t_header = Table(header_buttons_data, colWidths=[130, 90, 284])
    t_header.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_bg_light]),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 14))

    # ==================== SECTION 2: EXECUTIVE 3D COMMAND CENTER ====================
    story.append(Paragraph("2. Executive 3D Command Center (`/`)", h1_style))
    story.append(Paragraph("The primary high-altitude dashboard providing operational oversight, financial KPIs, and 3D visualizers.", body_style))

    dash_buttons_data = [
        [Paragraph("Feature / Button", table_header_style), Paragraph("Component", table_header_style), Paragraph("Operational Impact & Details", table_header_style)],
        [
            Paragraph("<b>Review Pending Queue (2)</b>", table_cell_bold),
            Paragraph("Glowing CTA Button", table_cell_style),
            Paragraph("Instantly routes the operations dispatcher to the live dispatch operate board filtered directly to unallocated master journeys.", table_cell_style)
        ],
        [
            Paragraph("<b>Gross Revenue Card</b>", table_cell_bold),
            Paragraph("Hero Metric 1", table_cell_style),
            Paragraph("Calculates real-time gross passenger revenue ($ AUD) inclusive of 10% Australian GST, with automatic Ex-GST net revenue breakdown.", table_cell_style)
        ],
        [
            Paragraph("<b>Net Operating Profit Card</b>", table_cell_bold),
            Paragraph("Hero Metric 2", table_cell_style),
            Paragraph("Calculates Net Operating Profit = Gross Revenue (Ex GST) - Direct Fleet Costs (Driver Payouts + Partner Offloads), displaying exact margin %.", table_cell_style)
        ],
        [
            Paragraph("<b>Pending Dispatch Queue Card</b>", table_cell_bold),
            Paragraph("Hero Metric 3", table_cell_style),
            Paragraph("Monitors unallocated master bookings awaiting human verification or driver conflict resolution with pulsating warning indicator.", table_cell_style)
        ],
        [
            Paragraph("<b>On-Time Arrival Rate Card</b>", table_cell_bold),
            Paragraph("Hero Metric 4", table_cell_style),
            Paragraph("Aggregates chauffeur punctuality (% of trips where <code>arrived_at &lt;= pickup_datetime</code>) and fleet average passenger rating.", table_cell_style)
        ],
        [
            Paragraph("<b>3D Luxury Car Showroom</b>", table_cell_bold),
            Paragraph("Three.js WebGL Canvas", table_cell_style),
            Paragraph("Interactive 360° mouse drag & touch orbit rotating luxury vehicle showroom with metallic clearcoat shaders, xenon lights, and alloy rims.", table_cell_style)
        ],
        [
            Paragraph("<b>Color Palette Selector</b>", table_cell_bold),
            Paragraph("Paint Picker (4 Colors)", table_cell_style),
            Paragraph("Dynamically swaps 3D car paint shaders between Obsidian Black (#0D1117), Champagne Gold (#D4AF37), Pearl White (#F8FAFC), and Royal Sapphire (#0F274A).", table_cell_style)
        ],
        [
            Paragraph("<b>Fleet Class Selector Tabs</b>", table_cell_bold),
            Paragraph("5 Chassis Buttons", table_cell_style),
            Paragraph("Swaps 3D geometry and specs between Executive Sedan, Premium Sedan, Premium SUV, People Mover Van, and Minibus Shuttle.", table_cell_style)
        ],
        [
            Paragraph("<b>3D Dispatch Radar Globe</b>", table_cell_bold),
            Paragraph("Three.js Airspace Canvas", table_cell_style),
            Paragraph("Rotating 3D wireframe globe displaying flight trajectory arcs (MEL, SYD, BNE, PER), airport GPS pins, and active in-bound flight counts.", table_cell_style)
        ],
        [
            Paragraph("<b>Allocate Driver &rarr; (Queue)</b>", table_cell_bold),
            Paragraph("1-Click Quick Action", table_cell_style),
            Paragraph("Directly opens chauffeur allocation drawer for the selected master booking item in the Human-in-the-Loop queue.", table_cell_style)
        ],
    ]

    t_dash = Table(dash_buttons_data, colWidths=[130, 100, 274])
    t_dash.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 4.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4.5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_bg_light]),
    ]))
    story.append(t_dash)
    story.append(Spacer(1, 14))

    # ==================== SECTION 3: LIVE OPERATE BOARD ====================
    story.append(Paragraph("3. Live Operate & Dispatch Board (`/operate`)", h1_style))
    story.append(Paragraph("The real-time operational engine implementing the Add-Allocate-Settle lifecycle.", body_style))

    operate_buttons_data = [
        [Paragraph("Feature / Control", table_header_style), Paragraph("Component", table_header_style), Paragraph("Functional Behavior & Safeguards", table_header_style)],
        [
            Paragraph("<b>Table / Kanban Toggle</b>", table_cell_bold),
            Paragraph("View Switcher Tabs", table_cell_style),
            Paragraph("Switches between high-density operational Master Table View and Kanban Stage Board (PENDING, ALLOCATED, EN_ROUTE, COMPLETED).", table_cell_style)
        ],
        [
            Paragraph("<b>Search & Filter Bar</b>", table_cell_bold),
            Paragraph("Input Query Engine", table_cell_style),
            Paragraph("Instant multi-field filtering across Booking Number (`CCM-XXXX`), Passenger Name, Phone, and Route Address.", table_cell_style)
        ],
        [
            Paragraph("<b>Allocate Chauffeur Modal</b>", table_cell_bold),
            Paragraph("Action Modal Trigger", table_cell_style),
            Paragraph("Opens allocation panel to assign driver and company vehicle. Automatically sets driver fixed payout allocation cost.", table_cell_style)
        ],
        [
            Paragraph("<b>Schedule Conflict Guard</b>", table_cell_bold),
            Paragraph("Automated Validation Engine", table_cell_style),
            Paragraph("Prevents double-booking drivers by checking overlapping active jobs within a <b>90-minute safety buffer</b>.", table_cell_style)
        ],
        [
            Paragraph("<b>Subcontractor Offload Drawer</b>", table_cell_bold),
            Paragraph("Partner Dispatch Lane", table_cell_style),
            Paragraph("Broadcasts job offers to affiliate partners with a <b>15-minute countdown expiry window</b>. Enforces Negative Margin Guards.", table_cell_style)
        ],
    ]

    t_operate = Table(operate_buttons_data, colWidths=[130, 100, 274])
    t_operate.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 4.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4.5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_bg_light]),
    ]))
    story.append(t_operate)
    story.append(Spacer(1, 14))

    # ==================== SECTION 4: INSTANT QUOTE & BOOKING ENGINE ====================
    story.append(Paragraph("4. Instant 3D Quote & Multi-Leg Booking Engine (`/quotes`)", h1_style))
    story.append(Paragraph("Customer and corporate quotation builder supporting multi-leg and hourly hire journeys.", body_style))

    story.append(Paragraph("<b>Key Features & Interactive Buttons:</b>", h2_style))
    story.append(Paragraph("&bull; <b>Journey Mode Selector:</b> Toggle between <i>Point-to-Point (One-Way)</i>, <i>Return Journey</i> (auto-applies 10% round-trip discount), and <i>Hourly As-Directed</i>.", bullet_style))
    story.append(Paragraph("&bull; <b>Airport Meet & Greet Toggle:</b> Enables commercial flight number entry, auto-connecting the leg to real-time flight tracking.", bullet_style))
    story.append(Paragraph("&bull; <b>10% Australian GST Calculator:</b> Auto-calculates 1/11th GST tax breakdown in real-time.", bullet_style))
    story.append(Paragraph("&bull; <b>25% Deposit vs 100% Full Payment:</b> Split payment selector for advance bookings (&gt; 7 days).", bullet_style))
    story.append(Paragraph("&bull; <b>Confirm Master Booking (`CCM-XXXXX`) Button:</b> Creates master booking, child journey legs, and triggers confetti animation.", bullet_style))
    story.append(Spacer(1, 14))

    # ==================== SECTION 5: DRIVER MOBILE WEB PWA ====================
    story.append(Paragraph("5. Driver Mobile PWA Portal (`/driver-portal`)", h1_style))
    story.append(Paragraph("Dedicated smartphone interface for professional chauffeurs.", body_style))

    story.append(Paragraph("<b>Chauffeur 4-Step Trip Stepper Buttons:</b>", h2_style))
    story.append(Paragraph("&bull; <b>1. En Route Button:</b> Driver starts travel to pickup. Updates leg status to <code>EN_ROUTE</code> and sets driver to <code>ON_TRIP</code>.", bullet_style))
    story.append(Paragraph("&bull; <b>2. Arrived Button:</b> Driver reaches location. Updates status to <code>ARRIVED</code> and auto-dispatches passenger arrival SMS.", bullet_style))
    story.append(Paragraph("&bull; <b>3. Picked Up Button:</b> Passenger boards the vehicle. Updates status to <code>PICKED_UP</code>.", bullet_style))
    story.append(Paragraph("&bull; <b>4. Completed Button:</b> Trip finishes. Leg marked <code>COMPLETED</code>, driver auto-toggled to <code>AVAILABLE</code>, and trip earnings added.", bullet_style))
    story.append(Paragraph("&bull; <b>Privacy Isolation Gate:</b> Customer total fare is completely hidden from the driver; only driver payout is displayed.", bullet_style))
    story.append(Paragraph("&bull; <b>Simulate GPS Telemetry Ping:</b> Sends live latitude/longitude coordinates to fleet dispatch map.", bullet_style))
    story.append(Spacer(1, 14))

    # ==================== SECTION 6: FLIGHT RADAR & AUTOMATION ====================
    story.append(Paragraph("6. Airport Flight Radar & Automation (`/flights`)", h1_style))
    story.append(Paragraph("FlightAware integration for flight monitoring and delay management.", body_style))

    story.append(Paragraph("<b>Automation Controls & Features:</b>", h2_style))
    story.append(Paragraph("&bull; <b>Simulate Flight Radar Check Button:</b> Queries commercial flight tracking for real-time delays.", bullet_style))
    story.append(Paragraph("&bull; <b>Automated Delay Rescheduler:</b> Automatically applies +30 min domestic and +45 min international customs buffers to pickup times upon detected delays.", bullet_style))
    story.append(Paragraph("&bull; <b>Complimentary 60-Min Wait-Time Calculator:</b> First 60 minutes from touchdown are free; slider calculates $1.50/min excess wait charges thereafter.", bullet_style))
    story.append(Spacer(1, 14))

    # ==================== SECTION 7: GST INVOICING & REMITTANCE ====================
    story.append(Paragraph("7. GST Invoicing, Tax & Remittance Engine (`/invoicing`)", h1_style))
    story.append(Paragraph("Australian Tax Office (ATO) compliant financial and invoicing suite.", body_style))

    story.append(Paragraph("<b>Financial Controls & Invoicing Tools:</b>", h2_style))
    story.append(Paragraph("&bull; <b>Tax Invoice Ledger (`INV-YYYY-XXXX`):</b> Itemized invoices with 10% GST breakdown and printable PDF modal.", bullet_style))
    story.append(Paragraph("&bull; <b>FIFO Debt Allocation Remittance Tool:</b> Allocates corporate customer lump-sum payments to the oldest overdue invoice first.", bullet_style))
    story.append(Paragraph("&bull; <b>Australian BAS Report View:</b> Summarizes quarterly GST Box G1 (Total Sales), Box 1A (GST on Sales), and Net Sales Ex GST.", bullet_style))
    story.append(Paragraph("&bull; <b>Driver RCTI Settlement Generator:</b> Generates Recipient Created Tax Invoices with ABN GST registration credits.", bullet_style))
    story.append(Spacer(1, 14))

    # ==================== SECTION 8: PROFIT ANALYTICS & CSV EXPORTS ====================
    story.append(Paragraph("8. Profit Analytics & CSV Exports (`/analytics`)", h1_style))
    story.append(Paragraph("Executive margins, fleet utilization, driver KPI scorecards, and streaming CSV data exports.", body_style))

    story.append(Paragraph("<b>Analytics Visualizations & Export Buttons:</b>", h2_style))
    story.append(Paragraph("&bull; <b>Trip Profitability CSV Export Button:</b> Generates RFC 4180 compliant CSV stream of per-trip gross fares, driver payouts, partner offloads, and net margins.", bullet_style))
    story.append(Paragraph("&bull; <b>Financial Ledger CSV Export Button:</b> Exports full financial ledger of all credit/debit transactions and Stripe settlements.", bullet_style))
    story.append(Paragraph("&bull; <b>Interactive Revenue vs Cost Bar Chart:</b> Hardware-accelerated SVG chart with hover tooltips for daily revenue, direct fleet costs, and net operating profit.", bullet_style))
    story.append(Paragraph("&bull; <b>Chauffeur Performance Scorecard:</b> Real-time leaderboard tracking customer ratings, completed trips, and on-time arrival rate %.", bullet_style))
    story.append(Spacer(1, 14))

    # ==================== SECTION 9: PARTNERS & FLEET MANAGEMENT ====================
    story.append(Paragraph("9. Subcontractor Partner Network & Vehicle Fleet (`/partners-fleet`)", h1_style))
    story.append(Paragraph("Subcontractor compliance monitoring and active company vehicle registry.", body_style))

    story.append(Paragraph("<b>Compliance & Fleet Controls:</b>", h2_style))
    story.append(Paragraph("&bull; <b>Partner Insurance Compliance Gate:</b> Blocks job offloads to subcontractors whose Public Liability Insurance has expired.", bullet_style))
    story.append(Paragraph("&bull; <b>Register Subcontractor Modal:</b> Adds partner with accreditation number, insurance expiry date, and contact details.", bullet_style))
    story.append(Paragraph("&bull; <b>Fleet Vehicle Catalog:</b> Registers company vehicles with make, model, year, registration plate, and strict passenger/luggage capacities.", bullet_style))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully generated: {filename}")

if __name__ == "__main__":
    output_path = r"c:\Users\Administrator\Desktop\Driver App\Enterprise_Chauffeur_Platform_Complete_Manual.pdf"
    generate_manual_pdf(output_path)
