(() => {
    'use strict';


    const
        fs = require('fs'),
        express = require('express'),
        app = express(),
        router = express.Router(),
        bodyParser = require('body-parser'),
        cors = require('cors'),
        jwt = require('jsonwebtoken'),
        bcrypt = require('bcryptjs'),
        server = require('http').Server(app),
        io = require('socket.io')(server),
        parseString = require('xml2js').parseString,
        mongoose = require('mongoose'),
        Schema = mongoose.Schema,
        ObjectId = mongoose.ObjectId;
    
    const 
        schemas = require('./schemas'),
        key = 'horsedogjumpingjackrabbitsterminator';

    router.use(bodyParser.urlencoded({ extended: true }));
    router.use(bodyParser.json());

    app.set('PORT', process.env.PORT || 5080);

    app.use(cors());

    var
        CompanyAccountModel = mongoose.model('company', schemas.company),
        ProjectModel = mongoose.model('project', schemas.project);

    const DB_URL = 'mongodb://localhost:27017/Prewired';

    mongoose.connect(DB_URL, {
        useNewUrlParser: true
    });

    var _db = mongoose.connection;

    _db.on('error', console.error.bind(console, 'MongoDB connection error:'));

    var stripMeta = (obj, removables) => {
        for (var i = 0; i < removables.length; i++) {
            delete obj[removables[i]];
        }
        return obj;
    }

    router.post('/api/signup', (req, res) => {
        console.log(JSON.stringify(req.body));
        req.body.users[0].password = bcrypt.hashSync(req.body.users[0].password);
        let newCompany = new CompanyAccountModel(req.body);
        newCompany.save(err => {
            if (err) {
                res.status(500).send('Theres been a problem with our server :( sorry');
                throw err;
            } else {
                const accessToken = jwt.sign({ id: req.body.id }, key, {
                    expiresIn: (24 * 60 * 60)
                });
                res.status(200).send({
                    success: true,
                    access_token: accessToken
                });
            }
        });
    });

    router.post('/api/login', (req, res) => {
        console.log('looking for ' + req.body.email);
        var query = CompanyAccountModel.where({ users: { $elemMatch: { email: req.body.email } } });
        query.findOne((err, company) => {
            if (err) {
                res.status(500).send('Theres been a problem with our server :( sorry');
                throw err;
            } else if (company) {
                for (var i = 0; i < company.users.length; i++) {
                    if (company.users[i].email == req.body.email) {
                        const isValid = bcrypt.compareSync(req.body.password, company.users[i].password);
                        if (!isValid) {
                            res.status(422).send({
                                success: false,
                                msg: 'Invalid username or password!'
                            });
                        } else {
                            const accessToken = jwt.sign({ id: req.body.id }, key, {
                                expiresIn: (24 * 60 * 60)
                            });
                            res.status(200).send({
                                success: true,
                                access_token: accessToken,
                                user: company.users[i],
                                company: company
                            });
                        }
                        break;
                    }
                }
            } else {
                res.status(422).send({
                    success: false,
                    msg: 'Invalid username or password!'
                });
            }

        })
    });

    app.use(router);

    io.on('connection', socket => {
        console.log('New Conneciton');
        console.log(socket.client);
        socket.on('create-project', body => {
            var newProjectInfo = body.newProject,
                creatorId = body.creatorId;
            newProjectInfo.meta.creatorId = creatorId;
            newProjectInfo.meta.authorizedAccounts.push(creatorId);
            newProjectInfo.meta.date = new Date();
            var
                newProject = new ProjectModel(newProjectInfo),
                query = CompanyAccountModel.where({ id: creatorId });
            newProject.save(err => {
                if (err) {
                    throw err;
                } else {
                    CompanyAccountModel.findOneAndUpdate(query, {
                        '$push': {
                            'projects': newProjectInfo.id
                        }
                    }, (err, company) => {
                        socket.emit('create-projectRETURN', {
                            success: true
                        });
                    });
                }
            });
        });

        socket.on('get-project', body => {
            var query = ProjectModel.where({ id: body.id });
            query.findOne((err, project) => {
                if (err) {
                    socket.emit('get-projectRETURN', {
                        success: false,
                        project: null,
                        msg: 'Theres been a problem with our server :( sorry'
                    });
                    throw err;
                } else if (project) {
                    socket.emit('get-projectRETURN', {
                        success: true,
                        project: project,
                        msg: 'Success!'
                    });
                } else {
                    socket.emit('get-projectRETURN', {
                        success: false,
                        project: null,
                        msg: 'Could not find project. Has it been deleted?'
                    });
                }

            });
        });

        socket.on('get-project-set-by-id', body => {
            var query = CompanyAccountModel.where({ id: body.id });
            query.findOne((err, company) => {
                if (err) {
                    socket.emit('get-project-set-by-idRETURN', {
                        success: false
                    });
                } else {
                    var projectQuery = ProjectModel.where({ id: { $in: company.projects } });
                    projectQuery.find((err, projects) => {
                        if (err) {
                            socket.emit('get-project-set-by-idRETURN', {
                                success: false
                            });
                        } else {
                            if (projects) {
                                socket.emit('get-project-set-by-idRETURN', {
                                    success: true,
                                    projects: projects
                                });
                            } else {
                                socket.emit('get-project-set-by-idRETURN', {
                                    success: true,
                                    projects: []
                                });
                            }
                        }
                    });
                }
            });
        });

        socket.on('get-collaborators', body => {
            var projectQuery = ProjectModel.where({ id: body.projectId });
            projectQuery.findOne((err, project) => {
                if (err) {
                    socket.emit('get-collaboratorsRETURN', {
                        success: false,
                        msg: 'Theres been a problem with our server'
                    });
                } else if (project) {
                    var collabQuery = CompanyAccountModel.where({ id: { $in: project.meta.authorizedAccounts } });
                    collabQuery.find((err, companies) => {
                        if (err) {
                            socket.emit('get-collaboratorsRETURN', {
                                success: false,
                                msg: 'Theres been a problem with our server'
                            });
                        } else if (companies) {
                            var collabs = [];
                            for (var i = 0; i < companies.length; i++) {
                                let newCollab = {
                                    id: companies[i].id,
                                    name: companies[i].name,
                                    address: companies[i].address,
                                    phone: companies[i].phone,
                                    zip: companies[i].zip,
                                    state: companies[i].state,
                                    users: []
                                };
                                for (var j = 0; j < companies[i].users.length; j++) {
                                    newCollab.users.push({
                                        name: companies[i].users[j].name,
                                        phone: companies[i].users[j].phone,
                                        id: companies[i].users[j].id
                                    });
                                }
                                collabs.push(newCollab);
                            }
                            socket.emit('get-collaboratorsRETURN', {
                                success: true,
                                msg: 'Found Collaborators!',
                                collaborators: collabs
                            });
                        } else {
                            socket.emit('get-collaboratorsRETURN', {
                                success: false,
                                msg: 'No authorized accounts for project ' + body.projectId
                            });
                        }
                    });
                } else {
                    socket.emit('get-collaboratorsRETURN', {
                        success: false,
                        msg: 'Could not find project with id: ' + body.projectId
                    });
                }
            });
        });

        socket.on('send-project-invite', body => {
            var projectQuery = ProjectModel.where({ id: body.projectId }),
                userQuery = CompanyAccountModel.where({ users: { $elemMatch: { id: body.userId } } }),
                inviteeQuery = CompanyAccountModel.where({ users: { $elemMatch: { email: body.email } } });
            userQuery.findOne((err, company) => {
                if (err) {
                    socket.emit('send-project-inviteRETURN', {
                        msg: 'Sorry theres been a problem with our server',
                        success: false
                    });
                } else if (company) {
                    var user = undefined;
                    for (var i = 0; i < company.users.length; i++) {
                        if (company.users[i].id == body.userId) {
                            user = company.users[i];
                            break;
                        }
                    }
                    if (user) {
                        projectQuery.findOne((err, project) => {
                            if (err) {
                                socket.emit('send-project-inviteRETURN', {
                                    msg: 'Sorry theres been a problem with our server',
                                    success: false
                                });
                            } else if (project) {
                                inviteeQuery.findOneAndUpdate({
                                    '$push': {
                                        'projects': project.id
                                    }
                                }, (err, inviteeCompany) => {
                                    if (err) {
                                        socket.emit('send-project-inviteRETURN', {
                                            msg: 'Sorry theres been a problem with our server',
                                            success: false
                                        });
                                    } else if (inviteeCompany) {
                                        projectQuery.findOneAndUpdate({
                                            '$push': {
                                                'meta.authorizedAccounts': company.id
                                            }
                                        }, (err) => {
                                            if (err) {
                                                socket.emit('send-project-inviteRETURN', {
                                                    msg: 'Sorry theres been a problem with our server',
                                                    success: false
                                                });
                                            } else {
                                                socket.emit('send-project-inviteRETURN', {
                                                    msg: 'Successfully added ' + body.email + ' to project ' + project.id,
                                                    success: true
                                                });
                                            }
                                        });
                                    } else {
                                        socket.emit('send-project-inviteRETURN', {
                                            msg: 'Could not find company with user email: ' + body.email,
                                            success: false
                                        });
                                    }
                                });
                            } else {
                                socket.emit('send-project-inviteRETURN', {
                                    msg: 'Sorry could not find project with id ' + body.projectId,
                                    success: false
                                });
                            }
                        });
                        
                    } else {
                        socket.emit('send-project-inviteRETURN', {
                            msg: 'Could not find user with user id: ' + body.userId,
                            success: false
                        });
                    }
                } else {
                    socket.emit('send-project-inviteRETURN', {
                        msg: 'Could not find company with user id: ' + body.userId,
                        success: false
                    });
                }
            });

        });

        socket.on('submit-comment', body => {
            var projectQuery = ProjectModel.where({ id: body.projectId }),
                userQuery = CompanyAccountModel.where({ users: { $elemMatch: { id: body.userId } } });
            userQuery.findOne((err, company) => {
                if (err) {
                    socket.emit('submit-commentRETURN', {
                        msg: 'Sorry theres been a problem with our server',
                        success: false
                    });
                } else if (company) {
                    var user = undefined;
                    for (var i = 0; i < company.users.length; i++) {
                        if (company.users[i].id == body.userId) {
                            user = company.users[i];
                            break;
                        }
                    }
                    if (user) {
                        projectQuery.findOneAndUpdate({
                            '$push': {
                                'comments': {
                                    author: user.name,
                                    text: body.text,
                                    date: new Date(),
                                    replies: []
                                }
                            }
                        }, (err, project) => {
                            if (err) {
                                socket.emit('submit-commentRETURN', {
                                    msg: 'Sorry theres been a problem with our server',
                                    success: false
                                });
                            } else if (project) {
                                socket.emit('submit-commentRETURN', {
                                    msg: 'Submitted comment to ' + body.projectId,
                                    success: true
                                });
                            } else {
                                socket.emit('submit-commentRETURN', {
                                    msg: 'Could not find project with id: ' + body.projectId,
                                    success: false
                                });
                            }
                        });
                    } else {
                        socket.emit('submit-commentRETURN', {
                            msg: 'Could not find user with id: ' + body.userId,
                            success: false
                        });
                    }
                } else {
                    socket.emit('submit-commentRETURN', {
                        msg: 'Could not find company with user id: ' + body.userId,
                        success: false
                    });
                }
            });
        });
    });

    server.listen(app.get('PORT'), () => {
        console.log(`App listening on port ${app.get('PORT')}...`);
    });

})();