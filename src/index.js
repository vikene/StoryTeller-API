
import {MongoClient, ObjectID} from 'mongodb'
import {makeExecutableSchema} from 'graphql-tools'
import {graphiqlExpress, graphqlExpress} from 'graphql-server-express'
import express from 'express';
import * as bodyParser from 'body-parser';
import { isContext } from 'vm';
const jwt = require('jsonwebtoken')


export const start = async() => {
    try{ 
        const MongoDBURL = "mongodb://vikene:yoyojava@cluster0-shard-00-00-tdw7p.mongodb.net:27017,cluster0-shard-00-01-tdw7p.mongodb.net:27017,cluster0-shard-00-02-tdw7p.mongodb.net:27017/test?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin&retryWrites=true";
        var db;
        try{
             db = await MongoClient.connect(MongoDBURL);
        }
        catch(err){
            console.log(err);
        }
        const user_db = db.collection('User')
        const story_db = db.collection('Story')
        const upvotes_db = db.collection('Upvotes')
        var signOptions = {
            expiresIn:  "12h",
            algorithm:  "RS256"
           };
        var secret = "mysamplekeytoencrypt";
        const prepare = (o) => {
            if(o !== undefined){
                o._id = o._id.toString()
            }
            return o;
        } 
        const typeDefs = [`
        type User{
            _id: String
            username: String
            email: String
            hashPassword: String
            age: Int
            userScope: [String]
            story: [Story]
            upvotes: [Upvote]
            token: String
        }
        type Story{
            _id: String
            slug: String
            title: String                 
            description: String
            authorname: String
            author: User
            createdAt: String
            updatedAt: String
            tags: [String]
        }
        type Upvote{
            _id: String
            username: String
            storyname: String
            user: User
            story: Story
        }
        type Query{
            getuserbyname(username: String,token: String): User
            getusers(token: String): [User]
            getuserbyid(_id: String, token: String): User
            getstorybyslug(slug: String, token: String): Story
            getrandomstory(token: String): [Story]
            getrandomstories: [Story]
            loginUser(username: String, hashPassword:String): User
        }
        type Mutation{
            createUser(email: String, username: String, hashPassword:String, age: Int, userScope: [String]): User
            createStory(token: String,authorname: String, slug: String, title: String, description: String, createdAt: String): Story
            updateStory(token: String, authorname: String, slug: String, title: String, descripiton: String, updatedAt: String): Story
            createUpvote(token: String, username: String, storyname: String): Upvote
            deleteUpvote(token: String, username: String, storyname: String): String
            updateUser(token: String, email: String, username: String, age: Int, userscope: [String]): User
            updatePassword(token: String, email: String, hashPassword: String): User
        }
        schema{
            query: Query
            mutation: Mutation
        }
        `]
        const resolvers = [{
            Query: {
                getuserbyname: async (root,{username, token}) => {
                    let tok = jwt.verify(token,secret);
                    if(tok !== undefined){
                        return prepare(await user_db.findOne({username: username}))
                    }
                    else{
                        return "{message: 'sorry Auth error!'}"
                    }
                    
                },
                getusers: async (root, {token}) => {
                    let tok = jwt.verify(token,secret);
                    if(tok !== undefined){
                        return (await user_db.find({}).toArray()).map(prepare)
                    }
                    else{
                        return "{message: 'sorry Auth error!'}"
                    }     
                },
                getuserbyid: async (root, {_id,token}) => {
                    let tok = jwt.verify(token,secret);
                    if(tok !== undefined){
                        return prepare(await user_db.find(ObjectID(_id)))
                    }
                    else{
                        return "{message: 'sorry Auth error!'}"
                    } 
                },
                getstorybyslug: async (root, {slug,token})=> {
                    let tok = jwt.verify(token,secret);
                    if(tok !== undefined){
                        return prepare(await story_db.findOne({slug: slug}))
                    }
                    else{
                        return "{message: 'sorry Auth error!'}"
                    } 
                    
                },
                getrandomstory: async (root, {token}) =>{
                    let tok = jwt.verify(token,secret);
                    if(tok !== undefined){
                        return (await story_db.aggregate([{ $sample: { size: 1 } }]).toArray()).map(prepare)
                    }
                    else{
                        return "{message: 'sorry Auth error!'}"
                    }   
                },
                getrandomstories: async () => {
                    
                        return (await story_db.find({}).toArray()).map(prepare)
                    
                    
                },
                loginUser: async (root, args) => {
                    const res = await user_db.findOne({username: args.username, hashPassword: args.hashPassword});
                    if(res !== null){
                            
                            let token = jwt.sign({username: res.username}, secret )
                            return Object.assign(res, {token: token})
                    }
                    else{
                        return "{message: 'sorry ! username password wrong!'}"
                    }
                }
            },
            User: {
                story: async ({username}) => {
                    return (await story_db.find({authorname: username}).toArray()).map(prepare)
                },
                upvotes: async ({username}) => {
                    return (await upvotes_db.find({username: username }).toArray()).map(prepare);
                }
            },
            Story: {
                author: async ({authorname}) => {
                    return prepare(await user_db.findOne({username:  authorname}))
                }
            },
            Mutation: {
                createUser: async (root, args) => {
                    const res = await user_db.insert(args)
                    const output = prepare(await user_db.findOne(ObjectID(res.insertedIds[0])))
                    let token = jwt.sign({username: args.username},secret)
                    return Object.assign(output, {token: token})
                },
                createStory: async (root, args) => {
                    const inpToken = args.token;
                    delete args.token;
                    let tok = jwt.verify(inpToken,secret);
                    if(tok !== undefined){
                        const res = await story_db.insert(args)
                        const output = prepare(await story_db.findOne(ObjectID(res.insertedIds[0])))
                        return output;
                    }
                    else{
                        return "{message: 'sorry Auth error!'}"
                    }
                    
                },
                updateStory: async(root, args) => {
                    const inpToken = args.token;
                    delete args.token;
                    let tok = jwt.verify(inpToken,secret);
                    if(tok !== undefined){
                        const output = await story_db.findOne({slug: args.slug})
                        if(output !== null){
                            const updatedState = Object.assign(output, args)
                            const res = await story_db.update({slug: args.slug},updatedState)
                            return prepare(await story_db.findOne({slug: args.slug}))
                        }
                        else{
                            return "{message: 'failed to find the story id'}"
                        }
                    }
                    else{
                        return "{message: 'sorry Auth error!'}"
                    }
                    
                    
                },
                createUpvote: async (root, args) => {
                    const inpToken = args.token;
                    delete args.token;
                    let tok = jwt.verify(inpToken,secret);
                    if(tok !== undefined){
                        const res = await upvotes_db.insert(args)
                        return prepare(await upvotes_db.findOne(ObjectID(res.insertedIds[0])))
                    }
                    else{
                        return "{message: 'sorry Auth error!'}"
                    }
                    
                },
                deleteUpvote: async (root, args) => {
                    const inpToken = args.token;
                    delete args.token;
                    let tok = jwt.verify(inpToken,secret);
                    if(tok !== undefined){
                        const res = await upvotes_db.remove({username: args.username, storyname: args.storyname})
                        return "done"
                    }
                    else{
                        return "{message: 'sorry Auth error!'}"
                    }
                    
                },
                updateUser: async (root, args) => {
                    const inpToken = args.token;
                    delete args.token;
                    let tok = jwt.verify(inpToken,secret);
                    if(tok !== undefined){
                            const output = await user_db.findOne({username: args.username})
                        if(output !== null){
                            const updatedState = Object.assign(output, args)
                            const res = await user_db.update({username: args.username}, updatedState)
                            return prepare(await user_db.findOne({username: args.username}))
                        }
                        else{
                            return "{message: 'error finding user'}"
                        }
                    }
                    else{
                        return "{message: 'sorry Auth error!'}"
                    }
                    
                },
                updatePassword: async (root, args) => {
                    const inpToken = args.token;
                    delete args.token;
                    let tok = jwt.verify(inpToken,secret);
                    if(tok !== undefined){
                        const output = await user_db.findOne({username: args.username})
                        if(output !== null){
                            const updatedState = Object.assign(output, args)
                            const res = await user_db.update({username: args.username}, updatedState)
                            return prepare(await user_db.findOne({username: args.username}))
                        }
                        else{
                            return "{message: 'error finding user'}"
                        }
                    }
                    else{
                        return "{message: 'sorry Auth error!'}"
                    }
                    
                }
            }
        }
        ]

        const schema = makeExecutableSchema({
            typeDefs,
            resolvers
        })
        const app = express()
        app.use("/graphql",bodyParser.json(), graphqlExpress({schema}))
        app.use("/graphiql", graphiqlExpress({
            endpointURL: "/graphql"
        }))

        app.listen(process.env.PORT || 3000, function(err){
            if(err){
                console.log("ERROR")
            }
            console.log("LISTENING")
        })

    }
    catch(err){
        console.log(err)
    }
}