
var Singleton = (function () {
    var instance;

    function createInstance() {
        var mongojs = Meteor.npmRequire('mongojs');
        var db = mongojs(process.env.MONGO_URL);
        var mycollection = db.collection('users');

        //var object = new Object("I am the instance");
        return mycollection;
    }

    return {
        getInstance: function () {
            if (!instance) {
                instance = createInstance();
            }
            return instance;
        }
    };
})();


Meteor.methods({
    countUsers: function (query) {

        var instance1 = Singleton.getInstance();

        var filterQ = {};
        if(!!query) {
            // TODO: passing to regex directly could be dangerous
            filterQ = {
                $or: [
                    {'profile.name': {$regex: query, $options: 'i'}},
                    {'emails.address': {$regex: query, $options: 'i'}}
                ]
            }
        };

        var repos = Meteor.sync(function (done) {
            instance1.count(filterQ, function (err, res) {
                if (err) {
                    console.log(err);
                }
                done(err, res);
            });
        });
        if (repos.error) {
            throw new Meteor.Error(401, repos);
        } else {
            return repos.result;
        }
    },

    deleteUser: function (userId) {
        check(userId, String);

        var user = Meteor.user();
        if (!user || !Roles.userIsInRole(user, ['admin']))
            throw new Meteor.Error(401, "You need to be an admin to delete a user.");

        if (user._id == userId)
            throw new Meteor.Error(422, 'You can\'t delete yourself.');

        // remove the user
        Meteor.users.remove(userId);
    },

    addUserRole: function (userId, role) {
        check(userId, String);
        check(role, String);

        var user = Meteor.user();
        if (!user || !Roles.userIsInRole(user, ['admin']))
            throw new Meteor.Error(401, "You need to be an admin to update a user.");

        if (user._id == userId)
            throw new Meteor.Error(422, 'You can\'t update yourself.');

        // handle invalid role
        if (Meteor.roles.find({name: role}).count() < 1)
            throw new Meteor.Error(422, 'Role ' + role + ' does not exist.');

        // handle user already has role
        if (Roles.userIsInRole(userId, role))
            throw new Meteor.Error(422, 'Account already has the role ' + role);

        // add the user to the role
        Roles.addUsersToRoles(userId, role);
    },

    removeUserRole: function (userId, role) {
        check(userId, String);
        check(role, String);

        var user = Meteor.user();
        if (!user || !Roles.userIsInRole(user, ['admin']))
            throw new Meteor.Error(401, "You need to be an admin to update a user.");

        if (user._id == userId)
            throw new Meteor.Error(422, 'You can\'t update yourself.');

        // handle invalid role
        if (Meteor.roles.find({name: role}).count() < 1)
            throw new Meteor.Error(422, 'Role ' + role + ' does not exist.');

        // handle user already has role
        if (!Roles.userIsInRole(userId, role))
            throw new Meteor.Error(422, 'Account does not have the role ' + role);

        Roles.removeUsersFromRoles(userId, role);
    },

    addRole: function (role) {
        var user = Meteor.user();
        if (!user || !Roles.userIsInRole(user, ['admin']))
            throw new Meteor.Error(401, "You need to be an admin to update a user.");

        // handle existing role
        if (Meteor.roles.find({name: role}).count() > 0)
            throw new Meteor.Error(422, 'Role ' + role + ' already exists.');

        Roles.createRole(role);
    },

    removeRole: function (role) {
        var user = Meteor.user();
        if (!user || !Roles.userIsInRole(user, ['admin']))
            throw new Meteor.Error(401, "You need to be an admin to update a user.");

        // handle non-existing role
        if (Meteor.roles.find({name: role}).count() < 1)
            throw new Meteor.Error(422, 'Role ' + role + ' does not exist.');

        if (role === 'admin')
            throw new Meteor.Error(422, 'Cannot delete role admin');

        // remove the role from all users who currently have the role
        // if successfull remove the role
        Meteor.users.update(
            {roles: role},
            {$pull: {roles: role}},
            {multi: true},
            function (error) {
                if (error) {
                    throw new Meteor.Error(422, error);
                } else {
                    Roles.deleteRole(role);
                }
            }
        );
    },

    updateUserInfo: function (id, property, value) {
        check(id, String);
        check(property, String);
        check(value, String);

        var user = Meteor.user();
        if (!user || !Roles.userIsInRole(user, ['admin']))
            throw new Meteor.Error(401, "You need to be an admin to update a user.");

        if (property !== 'profile.name')
            throw new Meteor.Error(422, "Only 'name' is supported.");

        obj = {};
        obj[property] = value;
        Meteor.users.update({_id: id}, {$set: obj});

    },

    addUser: function (name, email, password) {
        check(email, String);
        check(password, String);
        check(name, String);

        var user, userId;
        user = Accounts.createUser({
            email: email,
            profile: {
                name: name
            }
        });
        userId = user;
        Accounts.setPassword(user, password);
        return user;
    },

    addAdmin: function (email, password, name) {
        check(email, String);
        check(password, String);
        check(name, String);

        if (Meteor.users.findOne({
                email: email
            })) {
            return console.log("user already exists");
        } else {
            return Meteor.call('addUser', name, email, password, function (err, userId) {
                if (err) {
                    return console.log(err);
                } else {
                    if (Meteor.users.findOne(userId)) {
                        Roles.addUsersToRoles(userId, ["admin"]);
                        Roles.addUsersToRoles(userId, ["superAdmin"]);
                    }
                    if (!Meteor.roles.findOne({
                            name: "admin"
                        })) {
                        return Roles.createRole("admin");
                    }
                }
            });
        }
    },

    impersonate: function (userId, adminUserId) {
        check(userId, String);
        check(adminUserId, String);

        if (!Meteor.users.findOne(userId))
            throw new Meteor.Error(404, 'User not found');

        var caller = Meteor.users.findOne(adminUserId);
        if (!Roles.userIsInRole(caller, ['admin']))
            throw new Meteor.Error(401,
                "You need to be an admin to update a user.");

        return this._setUserId(userId);
    }

});
