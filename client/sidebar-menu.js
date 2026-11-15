export const sections = [
  ["Main", [
    ["Dashboard",[["Admin Dashboard","dashboard"],["Teacher Dashboard","preview-teacher"],["Student Dashboard","preview-student"],["Parent Dashboard","preview-parent"]],"apps"],
    ["Application",[["Chat","messages"],["Call","contacts"],["Calendar","calendar"],["Email","email"],["To Do","todos"],["Notes","notes"],["File Manager","files"]],"stack"],
    ["Layouts",[["Default","!default"],["Mini","!mini"],["RTL","!rtl"],["Box","!boxed"],["Dark","!dark"]],"panel"]
  ]],
  ["People & Admission", [
    ["Students",[["Students","students"],["Student Profile","students"],["Admissions","admissions"],["Student Promotion"],["Alumni","students~Graduated"],["Student Attendance History","attendance"],["Student Documents"]],"cap"],
    ["Teachers",[["Teachers","teachers"],["Add Teacher","teachers+"],["Teacher Profile","teachers"],["Routine","timetable"]],"group"],
    ["Parents","accounts~parent","group"],
    ["Guardians","guardians","guardian"],
    ["Staff",[["Staff List","staff"],["Departments","departments"],["Designation","designations"]],"briefcase"],
    ["Users",[["Users","accounts"],["Roles & Permissions","roles"],["Delete Account Request"]],"profile"]
  ]],
  ["Academic", [
    ["Classes & Sections",[["Classes","classes"],["Classrooms"],["Sections","classes"],["Class Routine","timetable"],["Class Schedule","timetable"],["Academic Calendar","calendar"]],"classroom"],
    ["Subjects & Curriculum",[["Subjects","subjects"],["Curriculum"],["Syllabus Tracking"]],"book"],
    ["Timetable",[["Class Timetable","timetable"],["Teacher Timetable","timetable"]],"calendar"],
    ["Learning",[["Lesson Planning"],["Study Materials","files"],["Homework","homework"]],"book"],
    ["Examination",[["Exams","exams"],["Exam Types"],["Schedule Exam","exams+"],["Admit Card"],["Marks Entry","results+"],["Grade Setup"],["Exam Attendance"],["Exam Results","results"],["Report Cards"],["Performance Analytics"],["Subject Performance"],["Progress Reports"],["Ranking System"]],"certificate"]
  ]],
  ["HRM", [
    ["HR & Payroll",[["Employee Payroll"],["Salary Structure"],["Payslips"],["Leave Policies"],["Attendance Rules"]],"briefcase"],
    ["Holidays","calendar","calendar"],
    ["Attendance",[["Student Attendance","attendance"],["Teacher Attendance"],["Staff Attendance"],["Biometric / RFID"],["Leave List"]],"clipboard"]
  ]],
  ["Finance & Accounts", [
    ["Fees",[["Fee Structure"],["Fees Assign","fees+"],["Fee Collection","payments"],["Fees Type (Fee Categories)"],["Fee Groups"],["Fine Management"],["Scholarships"],["Due Reports","fees"],["Receipts","payments"]],"wallet"],
    ["Billing",[["Invoices","invoices"],["Invoice Details","invoices"],["Bank Transactions"],["Online Payments"],["Payment History","payments"],["Refunds"]],"receipt"],
    ["Accounts",[["Expenses"],["Expense Category"],["Income"],["Ledger"],["Financial Reports"],["Tax Reports"]],"bank"]
  ]],
  ["Campus Operations", [
    ["Library",[["Books","library"],["Categories"],["Issue Books","loans+"],["Return Books","loans"],["Members"],["Reports"],["Reservations","loans~Reserved"]],"library"],
    ["Transport",[["Routes","transport"],["Pickup Points"],["Vehicles"],["Drivers"],["Assign Vehicle"],["Assign Students"],["GPS Tracking"],["Route Scheduling"],["Fleet Logs","fleet"]],"bus"],
    ["Sports",[["Sports"],["Players"]],"ball"],
    ["Hostel",[["Hostel List","hostel"],["Hostel Rooms","hostel"],["Room Types"],["Allocation"],["Fees"],["Wardens"],["Visitor Log"]],"house"],
    ["Cafeteria",[["Menu Management"],["Meal Plans"],["Orders"],["Billing"]],"food"],
    ["Assets",[["Assets"],["Asset Allocation"],["Asset Maintenance"],["Stock Management"]],"package"],
    ["Security",[["Gate Entry"],["Exit Pass"],["Staff Entry"],["Visitor Verification"],["Visitor Log"],["Gate Pass"],["Appointment Requests"]],"shield"],
    ["Medical",[["Sick Room Log"],["Medical Visits"],["Health Alerts"]],"medical"]
  ]],
  ["Communication", [
    ["Broadcast",[["Announcements","announcements"],["Notice Board","announcements"],["Broadcast Scheduler"]],"megaphone"],
    ["SMS",[["Send SMS"],["Bulk SMS"],["Templates"],["Logs","delivery~SMS"]],"chat"],
    ["WhatsApp",[["Send Message"],["Bulk Messaging"],["Templates"],["Chat Inbox","messages"]],"phoneChat"],
    ["Notifications",[["Email Notifications"],["Push Notifications"],["Parent Communication","messages"]],"bell"],
    ["Automation",[["Workflow Rules"],["Trigger Actions"],["Scheduled Tasks"]],"workflow"]
  ]],
  ["Reports", [
    ["Reports & Analytics",[["Attendance Reports","attendance"],["Academic Reports"],["Student Performance"],["Class Analytics"],["Grade Reports","results"],["Fee Collection","payments"],["Teacher Performance"],["Custom Reports"]],"chart"],
    ["AI Insights",[["AI Command Center"],["Attendance Predictor"],["Risk Detection"],["Student Intelligence"],["Report Generator"],["Timetable Optimizer"],["Homework Evaluation"],["Teacher Productivity"],["Parent Insights"],["Fee Forecast"],["Student Assistant"]],"sparkle"],
    ["Achievements",[["Student Awards"],["Competitions"],["Certificate Records"]],"trophy"],
    ["Certificates",[["Generate Certificates"],["Student ID Cards"],["Bonafide Certificate"],["Transfer Certificate"],["ID Card Templates"]],"certificate"]
  ]],
  ["Administration", [
    ["Events",[["Events","calendar"],["Activities","activity"]],"calendarPlus"],
    ["Multi School",[["Tenant Settings"],["Subscription Plans"],["Plan Features"],["Usage Limits"],["Branch Management","#schools"],["Franchise Setup"],["Central Dashboard","dashboard"]],"school"],
    ["Mobile App",[["App Settings"],["API Keys"],["Push Configurations"]],"phoneDevice"]
  ]],
  ["Settings", [
    ["General",[["School Profile","#schools"],["Academic Year","#year"],["Preferences","#layouts"]],"settings"],
    ["Account & Security",[["Profile","profile"],["Security"],["OTP"],["Social Authentication"],["Session Management"],["Login Activity"],["Activity Logs","activity"]],"lock"],
    ["Academic",[["School Settings"],["Class Settings"],["Subject Settings"],["Grading Rules"],["Academic Settings"],["Religion"],["Section Settings"],["Timetable Settings"],["Exam Settings"]],"cap"],
    ["Financial Settings",[["Payment Settings"],["Payment Gateways"],["Tax Rates"],["Invoice Settings"],["Fee Rules"],["Discount Rules"]],"wallet"],
    ["Communication",[["Email Settings"],["Email Templates"],["SMS Settings"],["OTP"],["GDPR Cookies"]],"mail"],
    ["Localization",[["Language"],["Localization"],["Prefixes"]],"globe"],
    ["Integrations",[["Connected Apps"],["API Keys"],["Webhooks"]],"plug"],
    ["Appearance",[["Theme Settings","#layouts"],["Custom Fields"]],"palette"],
    ["System",[["Backup & Restore"],["Storage"],["Ban IP"],["GDPR"],["Logs","activity"],["Cache"],["Maintenance Mode"]],"server"]
  ]],
  ["CMS & Pages", [
    ["Pages",null,"file"],
    ["Blog",[["All Blogs"],["Add Blog"],["Categories"],["Comments"],["Tags"]],"edit"],
    ["Location",[["Countries"],["States"],["Cities"]],"pinMap"],
    ["Testimonials",null,"quote"],
    ["FAQ",null,"help"],
    ["Support",[["Contact Messages","messages"],["Tickets","tickets"]],"headphones"],
    ["Profile",[["User Profile","profile"],["Blank Page"]],"profile"],
    ["Authentication",[["Login",[["Cover"],["Illustration"],["Basic"]]],["Register",[["Cover"],["Illustration"],["Basic"]]],["Forgot Password",[["Cover"],["Illustration"],["Basic"]]],["Reset Password",[["Cover"],["Illustration"],["Basic"]]],["Email Verification",[["Cover"],["Illustration"],["Basic"]]],["2 Step Verification",[["Cover"],["Illustration"],["Basic"]]],["Lock Screen"]],"lock"],
    ["Error Pages",[["404 Error"],["500 Error"],["Coming Soon"],["Under Maintenance"]],"alert"]
  ]],
  ["UI Interface", [
    ["Base UI",[["Alerts"],["Accordion"],["Avatar"],["Badges"],["Buttons"],["Button Group"],["Breadcrumb"],["Card"],["Carousel"],["Collapse"],["Dropdowns"],["Grid"],["Images"],["Links"],["List Group"],["Modals"],["Offcanvas"],["Pagination"],["Popovers"],["Progress"],["Placeholders"],["Workspace"],["Attendance"],["Spinner"],["Tabs"],["Tooltips"],["Typography"]],"apps"],
    ["Dashboard UI",[["Statistics"],["Widgets"],["Lists"],["Activity"],["Analytics"],["Insights"],["Actions"],["Dashboard Cards"]],"grid"],
    ["Advanced UI",[["Clipboard"],["Drag & Drop"],["Scrollbar"],["Sweet Alerts"],["Lightbox"]],"sliders"],
    ["Charts",[["Apex Charts"],["Chart C3"],["Chart Js"],["Morris Charts"],["Flot Charts"],["Peity Charts"]],"chartLine"],
    ["Icons",[["Fontawesome Icons"],["Feather Icons"],["Ionic Icons"],["Material Icons"],["Pe7 Icons"],["Simpleline Icons"],["Themify Icons"],["Weather Icons"],["Typicon Icons"],["Flag Icons"]],"badge"],
    ["Forms",[["Form Elements",[["Basic Inputs"],["Checkbox & Radios"],["Input Groups"],["Grid & Gutters"],["Form Select"],["Input Masks"],["File Uploads"]]],["Layouts",[["Horizontal Form"],["Vertical Form"],["Floating Labels"]]],["Form Validation"],["Select2"],["Form Wizard"]],"form"],
    ["Tables",[["Basic Tables"],["Data Table"]],"table"]
  ]],
  ["Help", [
    ["Documentation",null,"book"],
    ["Changelog",[["v2.0"]],"history"],
    ["Multi Level",[["Multilevel 1"],["Multilevel 2",[["Multilevel 2.1"],["Multilevel 2.2",[["Multilevel 2.2.1"],["Multilevel 2.2.2"]]]]]],"layers"]
  ]]
];
