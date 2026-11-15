export const sections = [
  ["Main", [
    ["Dashboard",[["Admin Dashboard","dashboard"],["Teacher Dashboard","preview-teacher"],["Student Dashboard","preview-student"],["Parent Dashboard","preview-parent"]],"▦"],
    ["Application",[["Chat","messages"],["Call","contacts"],["Calendar","calendar"],["Email","email"],["To Do","todos"],["Notes","notes"],["File Manager","files"]],"▤"],
    ["Layouts",[["Default","!default"],["Mini","!mini"],["RTL","!rtl"],["Box","!boxed"],["Dark","!dark"]],"▦"]
  ]],
  ["People & Admission", [
    ["Students",[["Students","students"],["Student Profile","students"],["Admissions","admissions"],["Student Promotion"],["Alumni","students~Graduated"],["Student Attendance History","attendance"],["Student Documents"]],"◇"],
    ["Teachers",[["Teachers","teachers"],["Add Teacher","teachers+"],["Teacher Profile","teachers"],["Routine","timetable"]],"♙"],
    ["Parents","accounts~parent","♧"],
    ["Guardians","guardians","♧"],
    ["Staff",[["Staff List","staff"],["Departments","departments"],["Designation","designations"]],"♙"],
    ["Users",[["Users","accounts"],["Roles & Permissions","roles"],["Delete Account Request"]],"♙"]
  ]],
  ["Academic", [
    ["Classes & Sections",[["Classes","classes"],["Classrooms"],["Sections","classes"],["Class Routine","timetable"],["Class Schedule","timetable"],["Academic Calendar","calendar"]],"▧"],
    ["Subjects & Curriculum",[["Subjects","subjects"],["Curriculum"],["Syllabus Tracking"]],"▤"],
    ["Timetable",[["Class Timetable","timetable"],["Teacher Timetable","timetable"]],"▦"],
    ["Learning",[["Lesson Planning"],["Study Materials","files"],["Homework","homework"]],"▤"],
    ["Examination",[["Exams","exams"],["Exam Types"],["Schedule Exam","exams+"],["Admit Card"],["Marks Entry","results+"],["Grade Setup"],["Exam Attendance"],["Exam Results","results"],["Report Cards"],["Performance Analytics"],["Subject Performance"],["Progress Reports"],["Ranking System"]],"◇"]
  ]],
  ["HRM", [
    ["HR & Payroll",[["Employee Payroll"],["Salary Structure"],["Payslips"],["Leave Policies"],["Attendance Rules"]],"◈"],
    ["Holidays","calendar","▦"],
    ["Attendance",[["Student Attendance","attendance"],["Teacher Attendance"],["Staff Attendance"],["Biometric / RFID"],["Leave List"]],"✓"]
  ]],
  ["Finance & Accounts", [
    ["Fees",[["Fee Structure"],["Fees Assign","fees+"],["Fee Collection","payments"],["Fees Type (Fee Categories)"],["Fee Groups"],["Fine Management"],["Scholarships"],["Due Reports","fees"],["Receipts","payments"]],"◈"],
    ["Billing",[["Invoices","invoices"],["Invoice Details","invoices"],["Bank Transactions"],["Online Payments"],["Payment History","payments"],["Refunds"]],"▤"],
    ["Accounts",[["Expenses"],["Expense Category"],["Income"],["Ledger"],["Financial Reports"],["Tax Reports"]],"◈"]
  ]],
  ["Campus Operations", [
    ["Library",[["Books","library"],["Categories"],["Issue Books","loans+"],["Return Books","loans"],["Members"],["Reports"],["Reservations","loans~Reserved"]],"▤"],
    ["Transport",[["Routes","transport"],["Pickup Points"],["Vehicles"],["Drivers"],["Assign Vehicle"],["Assign Students"],["GPS Tracking"],["Route Scheduling"],["Fleet Logs","fleet"]],"▣"],
    ["Sports",[["Sports"],["Players"]],"◇"],
    ["Hostel",[["Hostel List","hostel"],["Hostel Rooms","hostel"],["Room Types"],["Allocation"],["Fees"],["Wardens"],["Visitor Log"]],"⌂"],
    ["Cafeteria",[["Menu Management"],["Meal Plans"],["Orders"],["Billing"]],"◈"],
    ["Assets",[["Assets"],["Asset Allocation"],["Asset Maintenance"],["Stock Management"]],"▧"],
    ["Security",[["Gate Entry"],["Exit Pass"],["Staff Entry"],["Visitor Verification"],["Visitor Log"],["Gate Pass"],["Appointment Requests"]],"◇"],
    ["Medical",[["Sick Room Log"],["Medical Visits"],["Health Alerts"]],"✚"]
  ]],
  ["Communication", [
    ["Broadcast",[["Announcements","announcements"],["Notice Board","announcements"],["Broadcast Scheduler"]],"◇"],
    ["SMS",[["Send SMS"],["Bulk SMS"],["Templates"],["Logs","delivery~SMS"]],"✉"],
    ["WhatsApp",[["Send Message"],["Bulk Messaging"],["Templates"],["Chat Inbox","messages"]],"✉"],
    ["Notifications",[["Email Notifications"],["Push Notifications"],["Parent Communication","messages"]],"◇"],
    ["Automation",[["Workflow Rules"],["Trigger Actions"],["Scheduled Tasks"]],"⚙"]
  ]],
  ["Reports", [
    ["Reports & Analytics",[["Attendance Reports","attendance"],["Academic Reports"],["Student Performance"],["Class Analytics"],["Grade Reports","results"],["Fee Collection","payments"],["Teacher Performance"],["Custom Reports"]],"▦"],
    ["AI Insights",[["AI Command Center"],["Attendance Predictor"],["Risk Detection"],["Student Intelligence"],["Report Generator"],["Timetable Optimizer"],["Homework Evaluation"],["Teacher Productivity"],["Parent Insights"],["Fee Forecast"],["Student Assistant"]],"◇"],
    ["Achievements",[["Student Awards"],["Competitions"],["Certificate Records"]],"◇"],
    ["Certificates",[["Generate Certificates"],["Student ID Cards"],["Bonafide Certificate"],["Transfer Certificate"],["ID Card Templates"]],"▤"]
  ]],
  ["Administration", [
    ["Events",[["Events","calendar"],["Activities","activity"]],"▦"],
    ["Multi School",[["Tenant Settings"],["Subscription Plans"],["Plan Features"],["Usage Limits"],["Branch Management","#schools"],["Franchise Setup"],["Central Dashboard","dashboard"]],"⌂"],
    ["Mobile App",[["App Settings"],["API Keys"],["Push Configurations"]],"▣"]
  ]],
  ["Settings", [
    ["General",[["School Profile","#schools"],["Academic Year","#year"],["Preferences","#layouts"]],"⚙"],
    ["Account & Security",[["Profile","profile"],["Security"],["OTP"],["Social Authentication"],["Session Management"],["Login Activity"],["Activity Logs","activity"]],"◇"],
    ["Academic",[["School Settings"],["Class Settings"],["Subject Settings"],["Grading Rules"],["Academic Settings"],["Religion"],["Section Settings"],["Timetable Settings"],["Exam Settings"]],"▤"],
    ["Financial Settings",[["Payment Settings"],["Payment Gateways"],["Tax Rates"],["Invoice Settings"],["Fee Rules"],["Discount Rules"]],"◈"],
    ["Communication",[["Email Settings"],["Email Templates"],["SMS Settings"],["OTP"],["GDPR Cookies"]],"✉"],
    ["Localization",[["Language"],["Localization"],["Prefixes"]],"◎"],
    ["Integrations",[["Connected Apps"],["API Keys"],["Webhooks"]],"▧"],
    ["Appearance",[["Theme Settings","#layouts"],["Custom Fields"]],"◇"],
    ["System",[["Backup & Restore"],["Storage"],["Ban IP"],["GDPR"],["Logs","activity"],["Cache"],["Maintenance Mode"]],"⚙"]
  ]],
  ["CMS & Pages", [
    ["Pages",null,"▤"],
    ["Blog",[["All Blogs"],["Add Blog"],["Categories"],["Comments"],["Tags"]],"▤"],
    ["Location",[["Countries"],["States"],["Cities"]],"◎"],
    ["Testimonials",null,"◇"],
    ["FAQ",null,"?"],
    ["Support",[["Contact Messages","messages"],["Tickets","tickets"]],"◇"],
    ["Profile",[["User Profile","profile"],["Blank Page"]],"♙"],
    ["Authentication",[["Login",[["Cover"],["Illustration"],["Basic"]]],["Register",[["Cover"],["Illustration"],["Basic"]]],["Forgot Password",[["Cover"],["Illustration"],["Basic"]]],["Reset Password",[["Cover"],["Illustration"],["Basic"]]],["Email Verification",[["Cover"],["Illustration"],["Basic"]]],["2 Step Verification",[["Cover"],["Illustration"],["Basic"]]],["Lock Screen"]],"◇"],
    ["Error Pages",[["404 Error"],["500 Error"],["Coming Soon"],["Under Maintenance"]],"◇"]
  ]],
  ["UI Interface", [
    ["Base UI",[["Alerts"],["Accordion"],["Avatar"],["Badges"],["Buttons"],["Button Group"],["Breadcrumb"],["Card"],["Carousel"],["Collapse"],["Dropdowns"],["Grid"],["Images"],["Links"],["List Group"],["Modals"],["Offcanvas"],["Pagination"],["Popovers"],["Progress"],["Placeholders"],["Workspace"],["Attendance"],["Spinner"],["Tabs"],["Tooltips"],["Typography"]],"▦"],
    ["Dashboard UI",[["Statistics"],["Widgets"],["Lists"],["Activity"],["Analytics"],["Insights"],["Actions"],["Dashboard Cards"]],"▦"],
    ["Advanced UI",[["Clipboard"],["Drag & Drop"],["Scrollbar"],["Sweet Alerts"],["Lightbox"]],"◇"],
    ["Charts",[["Apex Charts"],["Chart C3"],["Chart Js"],["Morris Charts"],["Flot Charts"],["Peity Charts"]],"▥"],
    ["Icons",[["Fontawesome Icons"],["Feather Icons"],["Ionic Icons"],["Material Icons"],["Pe7 Icons"],["Simpleline Icons"],["Themify Icons"],["Weather Icons"],["Typicon Icons"],["Flag Icons"]],"◇"],
    ["Forms",[["Form Elements",[["Basic Inputs"],["Checkbox & Radios"],["Input Groups"],["Grid & Gutters"],["Form Select"],["Input Masks"],["File Uploads"]]],["Layouts",[["Horizontal Form"],["Vertical Form"],["Floating Labels"]]],["Form Validation"],["Select2"],["Form Wizard"]],"▤"],
    ["Tables",[["Basic Tables"],["Data Table"]],"▦"]
  ]],
  ["Help", [
    ["Documentation",null,"?"],
    ["Changelog",[["v2.0"]],"▤"],
    ["Multi Level",[["Multilevel 1"],["Multilevel 2",[["Multilevel 2.1"],["Multilevel 2.2",[["Multilevel 2.2.1"],["Multilevel 2.2.2"]]]]]],"▦"]
  ]]
];
