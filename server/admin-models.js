import mongoose from 'mongoose';
const { Schema } = mongoose;
export const AdminRole = mongoose.model('AdminRole', new Schema({
  name: { type:String, required:true, trim:true, maxlength:80, unique:true },
  description: { type:String, maxlength:500, default:'' },
  baseRole: { type:String, enum:['admin','teacher','student','parent'], required:true },
  status: { type:String, enum:['Active','Inactive'], default:'Active' },
  permissions: [String], icon: { type:String, default:'shield' }, tone: { type:String, default:'purple' },
  createdBy: String,
}, { timestamps:true }));
export const AdminAudit = mongoose.model('AdminAudit', new Schema({
  actor: String, action: String, target: String, kind: { type:String, default:'role' },
}, { timestamps:true }));
export const DeletionRequest = mongoose.model('DeletionRequest', new Schema({
  userId: { type:Schema.Types.ObjectId, required:true },
  user: { name:String, email:String, role:String, department:String, branch:String, avatar:String },
  reason: { type:String, required:true, maxlength:500 },
  status: { type:String, enum:['Pending','Under Review','Manager Approved','Approved','Rejected','Scheduled','Completed','Cancelled'], default:'Pending' },
  priority: { type:String, enum:['Normal','High'], default:'Normal' },
  reviewer: String, notes: String, executeAfter: Date,
  history: [{ status:String, actor:String, date:{type:Date,default:Date.now} }],
}, { timestamps:true, optimisticConcurrency:true }));
DeletionRequest.schema.index({ userId:1 }, { unique:true, partialFilterExpression:{ status:{ $in:['Pending','Under Review','Manager Approved','Approved','Scheduled'] } } });
