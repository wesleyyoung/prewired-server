(() => {
    'use strict';

    const
        mongoose = require('mongoose'),
        Schema = mongoose.Schema;

    const CompanyAccountSchema = new Schema({
        id: String,
        name: String,
        projects: [String],
        address: String,
        state: String,
        zip: String,
        phone: String,
        email: String,
        chats: [{
            participants: [String],
            id: String,
            messages: [{
                from: String,
                fromUserId: String,
                id: String,
                content: String,
                date: Date,
                seen: Boolean
            }],
            creatorId: String
        }],
        users: [{
            id: String,
            name: String,
            email: String,
            username: String,
            password: String,
            tier: Number,
            chats: [{
                participants: [String],
                id: String,
                messages: [{
                    from: String,
                    fromUserId: String,
                    id: String,
                    content: String,
                    date: Date,
                    seen: Boolean
                }],
                creatorId: String
            }],
            
        }]
    });

    const ProjectSchema = new Schema({
        id: String,
        title: String,
        type: String,
        location: String,
        pics: [{
            description: String,
            img: Buffer, 
            content_type: String,
            date_uploaded: Date,
            uploaded_by: String
        }],
        group_convo: {
            authorizedAccounts: [String],
            updates: [{
                date: Date,
                type: String,
                content: String,
                author: String,
                id: String
            }],
            messages: [{
                from: String,
                fromUserId: String,
                id: String,
                content: String,
                date: Date,
                seenBy: [String]
            }]
        },
        updates: [{
            date: Date,
            type: String,
            content: String,
            author: String,
            id: String
        }],
        comments: [
            {
                author: String,
                text: String,
                date: Date,
                replies: [{
                    author: String,
                    text: String,
                    date: Date
                }]
            }
        ],
        description: String,
        finished: Boolean,
        rooms: [{
            id: String,
            name: String,
            description: String,
            pulls: [{
                id: String,
                wire: String,
                fromId: String,
                toId: String
            }],
            wallPlates: [{
                id: String,
                gang: Number
            }],
            mediaPanels: [{
                id: String,
                width: Number,
                height: Number
            }],
            conduitRuns: [{
                id: String,
                diameter: Number,
                fromId: String,
                toId: String
            }]
        }],
        clocks: [{
            clockedIn: Boolean,
            userId: String,
            companyId: String,
            projectId: String,
            time: Date
        }],
        meta: {
            date: Date,
            creatorId: String,
            authorizedAccounts: [String]
        }
    });

    exports.company = CompanyAccountSchema;
    exports.project = ProjectSchema;

})();