module.exports = function(app, io) {

    var Response = require('../lib/httpResponse');
    var Audit = require('mongoose').model('Audit');
    var AuditType = require('mongoose').model('AuditType');
    var auth = require('../lib/auth');
    var reportGenerator = require('../lib/report-generator');

    // Get audits list of user (all for admin) with regex filter on findings
    app.get("/api/audits", auth.hasRole('user'), function(req, res) {
        var filters = {};
        if (req.query.findingTitle) filters['findings.title'] = new RegExp(req.query.findingTitle, 'i');

        if (req.decodedToken.role === 'admin') {
            Audit.getAll(filters)
            .then(msg => Response.Ok(res, msg))
            .catch(err => Response.Internal(res, err))
        }
        else {
            Audit.getAllForUser(req.decodedToken.username, filters)
            .then(msg => Response.Ok(res, msg))
            .catch(err => Response.Internal(res, err))
        }
    });

    // Create audit with name, template and username provided
    app.post("/api/audits", auth.hasRole('user'), function(req, res) {
        if (!req.body.name || !req.body.language || !req.body.template) {
            Response.BadParameters(res, 'Missing some required paramters');
            return;
        }

        var audit = {};
        // Required params
        audit.name = req.body.name;
        audit.language = req.body.language;
        audit.template = req.body.template;

        Audit.create(audit, req.decodedToken.username)
        .then(msg => Response.Created(res, 'Audit created successfully'))
        .catch(err => Response.Internal(res, err))
    });

    // Get audit general information
    app.get("/api/audits/:auditId/general", auth.hasRole('user'), function(req, res) {
        Audit.getGeneral(req.params.auditId)
        .then(msg => Response.Ok(res, msg))
        .catch(err => Response.Internal(res, err))
    });

    // Update audit general information
    app.put("/api/audits/:auditId/general", auth.hasRole('user'), function(req, res) {
        var update = {};
        // Optional parameters
        if (req.body.name) update.name = req.body.name;
        if (req.body.auditType) update.auditType = req.body.auditType;
        if (req.body.location) update.location = req.body.location;
        if (req.body.date) update.date = req.body.date;
        if (req.body.date_start) update.date_start = req.body.date_start;
        if (req.body.date_end) update.date_end = req.body.date_end;
        if (req.body.client && req.body.client._id) {
            update.client = {};
            update.client._id = req.body.client._id;
        }
        if (req.body.company && req.body.company._id) {
            update.company = {};
            update.company._id = req.body.company._id;
        }
        if (req.body.collaborators) update.collaborators = req.body.collaborators;
        if (req.body.language) update.language = req.body.language;
        if (req.body.scope && typeof(req.body.scope === "array")) {
            update.scope = req.body.scope.map(item => {return {name: item}});
        }
        if (req.body.template) update.template = req.body.template;        

        Audit.updateGeneral(req.params.auditId, update)
        .then(msg => {
            io.to(req.params.auditId).emit('updateAudit');
            Response.Ok(res, msg)
        })
        .catch(err => Response.Internal(res, err))
    });

    // Get audit network information
    app.get("/api/audits/:auditId/network", auth.hasRole('user'), function(req, res) {
        Audit.getNetwork(req.params.auditId)
        .then(msg => Response.Ok(res, msg))
        .catch(err => Response.Internal(res, err))
    });

    // Update audit network information
    app.put("/api/audits/:auditId/network", auth.hasRole('user'), function(req, res) {
        var update = {};
        // Optional parameters
        if (req.body.scope) update.scope = req.body.scope;

        Audit.updateNetwork(req.params.auditId, update)
        .then(msg => Response.Ok(res, msg))
        .catch(err => Response.Internal(res, err))
    });

    // Add finding to audit
    app.post("/api/audits/:auditId/findings", auth.hasRole('user'), function(req, res) {
        if (!req.body.title) {
            Response.BadParameters(res, 'Missing some required paramters: title');
            return;
        }

        var finding = {};
        // Required parameters
        finding.title = req.body.title;
        
        // Optional parameters
        if (req.body.vulnType) finding.vulnType = req.body.vulnType;
        if (req.body.description) finding.description = req.body.description;
        if (req.body.observation) finding.observation = req.body.observation;
        if (req.body.remediation) finding.remediation = req.body.remediation;
        if (req.body.remediationComplexity) finding.remediationComplexity = req.body.remediationComplexity;
        if (req.body.priority) finding.priority = req.body.priority;
        if (req.body.references) finding.references = req.body.references;
        if (req.body.cvssv3) finding.cvssv3 = req.body.cvssv3;
        if (req.body.cvssScore) finding.cvssScore = req.body.cvssScore;
        if (req.body.cvssSeverity) finding.cvssSeverity = req.body.cvssSeverity;
        if (req.body.paragraphs) finding.paragraphs = req.body.paragraphs;
        if (req.body.scope) finding.scope = req.body.scope;
        if (req.body.status !== undefined) finding.status = req.body.status;

        Audit.createFinding(req.params.auditId, finding)
        .then(msg => {
            io.to(req.params.auditId).emit('updateAudit');
            Response.Ok(res, msg)
        })
        .catch(err => Response.Internal(res, err))
    });

    // Get findings list title
    app.get("/api/audits/:auditId/findings", auth.hasRole('user'), function(req, res) {
        Audit.getFindings(req.params.auditId)
        .then(msg => Response.Ok(res, msg))
        .catch(err => Response.Internal(res, err))
    });

    // Get finding of audit
    app.get("/api/audits/:auditId/findings/:findingId", auth.hasRole('user'), function(req, res) {
        Audit.getFinding(req.params.auditId, req.params.findingId)
        .then(msg => Response.Ok(res, msg))
        .catch(err => Response.Internal(res, err))
    });

    // Update finding of audit
    app.put("/api/audits/:auditId/findings/:findingId", auth.hasRole('user'), function(req, res) {
        var finding = {};
        // Optional parameters
        if (req.body.title) finding.title = req.body.title;
        if (req.body.vulnType) finding.vulnType = req.body.vulnType;
        if (req.body.description) finding.description = req.body.description;
        if (req.body.observation) finding.observation = req.body.observation;
        if (req.body.remediation) finding.remediation = req.body.remediation;
        if (req.body.remediationComplexity) finding.remediationComplexity = req.body.remediationComplexity;
        if (req.body.priority) finding.priority = req.body.priority;
        if (req.body.references) finding.references = req.body.references;
        if (req.body.cvssv3) finding.cvssv3 = req.body.cvssv3;
        if (req.body.cvssScore) finding.cvssScore = req.body.cvssScore;
        if (req.body.cvssSeverity) finding.cvssSeverity = req.body.cvssSeverity;
        if (req.body.paragraphs) finding.paragraphs = req.body.paragraphs;
        if (req.body.scope) finding.scope = req.body.scope;
        if (req.body.status !== undefined) finding.status = req.body.status;

        Audit.updateFinding(req.params.auditId, req.params.findingId, finding)
        .then(msg => {
            io.to(req.params.auditId).emit('updateAudit');            
            Response.Ok(res, msg)
        })
        .catch(err => Response.Internal(res, err))
    });

    // Delete finding of audit
    app.delete("/api/audits/:auditId/findings/:findingId", auth.hasRole('user'), function(req, res) {
        Audit.deleteFinding(req.params.auditId, req.params.findingId)
        .then(msg => {
            io.to(req.params.auditId).emit('updateAudit');            
            Response.Ok(res, msg);
        })
        .catch(err => Response.Internal(res, err))
    });

     // Get audit Summary
     app.get("/api/audits/:auditId/summary", auth.hasRole('user'), function(req, res) {
        Audit.getSummary(req.params.auditId)
        .then(msg => Response.Ok(res, msg))
        .catch(err => Response.Internal(res, err))
    });

    // Update audit Summary
    app.put("/api/audits/:auditId/summary", auth.hasRole('user'), function(req, res) {
        if (!req.body.summary) {
            Response.BadParameters(res, 'Missing some required paramters');
            return;
        }
        var update = {};
        // Mandatory parameters
        update.summary = req.body.summary;    

        Audit.updateSummary(req.params.auditId, update)
        .then(msg => {
            Response.Ok(res, msg)
        })
        .catch(err => Response.Internal(res, err))
    });

    // Add section to audit
    app.post("/api/audits/:auditId/sections", auth.hasRole('user'), function(req, res) {
        if (!req.body.field || !req.body.name) {
            Response.BadParameters(res, 'Missing some required paramters: field, name');
            return;
        }

        var section = {};
        // Required parameters
        section.name = req.body.name;
        section.field = req.body.field;

        Audit.createSection(req.params.auditId, section)
        .then(msg => {
            io.to(req.params.auditId).emit('updateAudit');
            Response.Ok(res, msg)
        })
        .catch(err => Response.Internal(res, err))
    });

    // Get section of audit
    app.get("/api/audits/:auditId/sections/:sectionId", auth.hasRole('user'), function(req, res) {
        Audit.getSection(req.params.auditId, req.params.sectionId)
        .then(msg => Response.Ok(res, msg))
        .catch(err => Response.Internal(res, err))
    });

    // Update section of audit
    app.put("/api/audits/:auditId/sections/:sectionId", auth.hasRole('user'), function(req, res) {
        var section = {};
        // Optional parameters
        if (req.body.paragraphs) section.paragraphs = req.body.paragraphs;

        Audit.updateSection(req.params.auditId, req.params.sectionId, section)
        .then(msg => {
            Response.Ok(res, msg)
        })
        .catch(err => Response.Internal(res, err))
    });

    // Delete section of audit
    app.delete("/api/audits/:auditId/sections/:sectionId", auth.hasRole('user'), function(req, res) {
        Audit.deleteSection(req.params.auditId, req.params.sectionId)
        .then(msg => {
            io.to(req.params.auditId).emit('updateAudit');            
            Response.Ok(res, msg);
        })
        .catch(err => Response.Internal(res, err))
    });

    // Get Audit with ID
    app.get("/api/audits/:auditId/", auth.hasRole('user'), function(req, res) {
        Audit.getAudit(req.params.auditId)
        .then(msg => Response.Ok(res, msg))
        .catch(err => Response.Internal(res, err))
    });

    // Generate Report for specific audit
    app.get("/api/audits/:auditId/generate", auth.hasRole('user'), function(req, res){
        if (req.decodedToken.role === 'admin') {
            Audit.getAudit(req.params.auditId)
            .then( audit => {
                var reportDoc = reportGenerator.generateDoc(audit);
                Response.SendFile(res, `${audit.name}.docx`, reportDoc);
            })
            .catch(err => Response.Internal(res, err));
        }
        else {
            Audit.getAuditForUser(req.params.auditId, req.decodedToken.username)
            .then( audit => {
                var reportDoc = reportGenerator.generateDoc(audit);
                Response.SendFile(res, `${audit.name}.docx`, reportDoc);
            })
            .catch(err => Response.Internal(res, err))
        }
    });
}