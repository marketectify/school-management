import express from 'express';
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import { systemRoles, allowed, validatePermissions, transitionAllowed } from '../administration.js';
import { AdminRole, AdminAudit, DeletionRequest } from './admin-models.js';
import { hashPassword } from './auth.js';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const validId = id => mongoose.isObjectIdOrHexString(id);
export function administrator(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message:'Administrator access required.' });
  next();
}
export function administrationRoutes({ User, Session, models, Role = AdminRole, Audit = AdminAudit, Request = DeletionRequest }) {
  const router = express.Router();
  router.use(administrator);
  router.use((req,res,next) => {
    const resource = req.path.startsWith('/roles') ? 'roles' : req.path.startsWith('/requests') ? 'deletionRequests' : 'users';
    const action = req.method === 'GET' ? 'view' : req.method === 'POST' ? 'create' : req.method === 'DELETE' ? 'delete' : 'edit';
    if (!allowed(req.user, resource, action)) return res.status(403).json({ message:'Your role does not allow this action.' });
    next();
  });
  const audit = (req, action, target, kind='user') => Audit.create({ actor:req.user.name, action, target, kind });
  const roleFor = async id => systemRoles.find(row => row._id === id) || (validId(id) ? await Role.findById(id) : null);
  async function protect(req, target) {
    if (String(target._id) === String(req.user._id)) fail('You cannot change or remove your own access here.',409);
    // Only unrestricted administrators can change other unrestricted administrators.
    if (target.role === 'admin' && req.user.access) fail('An unrestricted administrator must manage this account.',403);
  }
  async function fields(body, creating=false, actor) {
    const { name, email, roleId, department='', phone='', branch='', status='Active', studentIds=[], password, avatar='' } = body || {};
    if(typeof avatar!=='string'||avatar.length>20000||(avatar&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(avatar))) fail('Choose a valid profile photo.');
    if (typeof name !== 'string' || !name.trim() || name.length>120 || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 ||
        !['Active','Inactive','Blocked','Pending'].includes(status) || [department,phone,branch].some(v => typeof v!=='string'||v.length>120)) fail('Enter valid user details.');
    const profile = await roleFor(roleId);
    if (!profile || profile.status !== 'Active') fail('Choose an active role.');
    if (actor?.access && profile.permissions.some(p=>!actor.access.includes(p))) fail('You cannot assign permissions beyond your own access.',403);
    if (!Array.isArray(studentIds) || studentIds.some(id=>!validId(id))) fail('Choose valid linked students.');
    const ids=[...new Set(studentIds)];
    if ((profile.baseRole==='student' && ids.length!==1) || (profile.baseRole==='parent' && !ids.length) || (!['student','parent'].includes(profile.baseRole) && ids.length) || await models.students.countDocuments({_id:{$in:ids}})!==ids.length) fail('Select the student records appropriate for this role.');
    if ((creating || password) && (typeof password!=='string'||password.length<12||password.length>128)) fail('Use a password between 12 and 128 characters.');
    return { name:name.trim(), email:email.trim().toLowerCase(), role:profile.baseRole, roleId:['system-admin','system-teacher','system-student','system-parent'].includes(profile._id)?null:String(profile._id), department:department.trim(), phone:phone.trim(), branch:branch.trim(), status, avatar, studentIds:ids, ...(password?{passwordHash:await hashPassword(password)}:{}) };
  }
  router.get('/users',async (_req,res)=>res.json(await User.find().sort({createdAt:-1}).lean()));
  router.post('/users',async (req,res)=>{
    const user=await User.create(await fields(req.body,true,req.user));
    await audit(req,'Account created',user.name);
    const row=user.toObject(); delete row.passwordHash; res.status(201).json(row);
  });
  router.put('/users/:id',async(req,res)=>{
    if(!validId(req.params.id)) fail('Invalid account.');
    const target=await User.findById(req.params.id); if(!target) fail('Account not found.',404);
    await protect(req,target);
    const update=await fields(req.body,false,req.user);
    await User.updateOne({_id:target._id},{$set:update},{runValidators:true});
    await Session.deleteMany({userId:target._id});
    await audit(req,'Account updated',target.name); res.sendStatus(204);
  });
  router.patch('/users/:id/status',async(req,res)=>{
    if(!validId(req.params.id)||!['Active','Inactive','Blocked'].includes(req.body?.status)) fail('Choose a valid account status.');
    const target=await User.findById(req.params.id); if(!target) fail('Account not found.',404);
    await protect(req,target);
    await User.updateOne({_id:target._id},{$set:{status:req.body.status}});
    await Session.deleteMany({userId:target._id}); await audit(req,'Access '+req.body.status.toLowerCase(),target.name); res.sendStatus(204);
  });
  router.get('/roles',async (_req,res)=>res.json([...systemRoles,...await Role.find().sort({createdAt:-1}).lean()]));
  router.post('/roles',async(req,res)=>{
    const {name,description='',baseRole,permissions=[]}=req.body||{};
    if(typeof name!=='string'||!name.trim()||name.length>80||typeof description!=='string'||description.length>500||!['admin','teacher','student','parent'].includes(baseRole)||!validatePermissions(permissions)) fail('Enter a role name, base role and valid permissions.');
    if(systemRoles.some(role=>role.name.toLowerCase()===name.trim().toLowerCase())) fail('That role name is reserved.',409);
    if(req.user.access && permissions.some(p=>!req.user.access.includes(p))) fail('You cannot grant permissions beyond your own access.',403);
    const row=await Role.create({name:name.trim(),description,baseRole,permissions:[...new Set(permissions)],createdBy:req.user.name});
    await audit(req,'Role created',row.name,'role'); res.status(201).json(row);
  });
  router.put('/roles/:id',async(req,res)=>{
    if(!validId(req.params.id)) fail('System roles are protected. Clone the role to customize it.',409);
    const {permissions,status}=req.body||{};
    if(!validatePermissions(permissions)||!['Active','Inactive'].includes(status)) fail('Choose valid permissions and status.');
    if(req.user.access && permissions.some(p=>!req.user.access.includes(p))) fail('You cannot grant permissions beyond your own access.',403);
    const row=await Role.findById(req.params.id); if(!row) fail('Role not found.',404);
    if(String(req.user.roleId)===String(row._id)) fail('You cannot change your own assigned role.',409);
    if(req.body.name!==undefined) {
      if(typeof req.body.name!=='string'||!req.body.name.trim()||req.body.name.length>80||systemRoles.some(r=>r.name.toLowerCase()===req.body.name.trim().toLowerCase())) fail('Enter a unique custom role name.');
      row.name=req.body.name.trim();
    }
    if(req.body.description!==undefined) {
      if(typeof req.body.description!=='string'||req.body.description.length>500) fail('Use a description of up to 500 characters.');
      row.description=req.body.description;
    }
    row.permissions=[...new Set(permissions)]; row.status=status; await row.save();
    await Session.deleteMany({userId:{$in:await User.distinct('_id',{roleId:String(row._id)})}});
    await audit(req,'Permissions updated',row.name,'role'); res.json(row);
  });
  router.delete('/roles/:id',async(req,res)=>{
    if(!validId(req.params.id)) fail('System roles cannot be deleted.',409);
    if(await User.exists({roleId:req.params.id})) fail('Reassign the users in this role before deleting it.',409);
    const row=await Role.findByIdAndDelete(req.params.id); if(!row) fail('Role not found.',404);
    await audit(req,'Role deleted',row.name,'role'); res.sendStatus(204);
  });
  router.get('/audit',async(_req,res)=>res.json(await Audit.find().sort({createdAt:-1}).limit(100).lean()));
  router.get('/requests',async(_req,res)=>res.json(await Request.find().sort({createdAt:-1}).lean()));
  router.post('/requests',async(req,res)=>{
    const {userId,reason,priority='Normal'}=req.body||{};
    if(!validId(userId)||typeof reason!=='string'||!reason.trim()||reason.length>500||!['Normal','High'].includes(priority)) fail('Select an account and enter a reason.');
    const target=await User.findById(userId); if(!target) fail('Account not found.',404); await protect(req,target);
    const row=await Request.create({userId,user:{name:target.name,email:target.email,role:target.role,department:target.department,branch:target.branch,avatar:target.avatar},reason:reason.trim(),priority,history:[{status:'Pending',actor:req.user.name}]});
    await audit(req,'Deletion requested',target.name,'request'); res.status(201).json(row);
  });
  router.patch('/requests/:id',async(req,res)=>{
    if(!validId(req.params.id)) fail('Invalid request.');
    const row=await Request.findById(req.params.id); if(!row) fail('Request not found.',404);
    const {status,notes='',confirmEmail}=req.body||{};
    if(!transitionAllowed(row.status,status)||typeof notes!=='string'||notes.length>1000) fail('This request cannot move to that stage.',409);
    const target=await User.findById(row.userId);
    if(status==='Approved'||status==='Scheduled'||status==='Completed') { if(!target) fail('Account no longer exists.',409); await protect(req,target); }
    if(status==='Scheduled') row.executeAfter=new Date(Date.now()+7*86400000);
    if(status==='Completed') {
      if(!row.executeAfter||row.executeAfter>new Date()) fail('The seven-day review period has not finished.',409);
      if(confirmEmail!==target.email) fail('Type the account email to confirm permanent removal.');
      await Request.db.transaction(async session => {
        const current=await Request.findOne({_id:row._id,status:'Scheduled',__v:row.__v}).session(session);
        if(!current) fail('The request changed while you were reviewing it. Refresh and try again.',409);
        current.status='Completed'; current.notes=notes; current.reviewer=req.user.name;
        current.history.push({status:'Completed',actor:req.user.name,date:new Date()});
        await current.save({session});
        await Session.deleteMany({userId:target._id},{session});
        await User.deleteOne({_id:target._id},{session});
        await Audit.create([{actor:req.user.name,action:'Deletion request completed',target:row.user.name,kind:'request'}],{session});
      });
      return res.json(await Request.findById(row._id));
    }
    row.status=status; row.notes=notes; row.reviewer=req.user.name; row.history.push({status,actor:req.user.name,date:new Date()}); await row.save();
    await audit(req,'Deletion request '+status.toLowerCase(),row.user.name,'request'); res.json(row);
  });
  return router;
}
