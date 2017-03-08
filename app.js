"use strict";

const url = require("url"),
    assert = require("assert"),
    http = require("http");

function splitN(string, separator, length) {
    if (length <= 1) return [string]
    let result = []
    do {
        let index = string.indexOf(separator)
        if (index < 0) {
            result.push(string)
            break
        }
        let [head, queue] = [string.substring(0, index), string.substring(index + separator.length, string.length)]
        result.push(head)
        string = queue
        if (result.length === length - 1) {
            result.push(string)
            break
        }
    } while (string !== "")
    return result
}

function pathJoin(...parts) {
    return parts.join("/").replace(/\/+/g, '/')
}

function stripSuffix(string, suffix) {
    while (string.endsWith(suffix)) {
        string = string.substr(0, string.length - 1)
    }
    return string
}


class NextError extends Error {
    constructor() {
        super();
        this.message = ("Next Called but no more handler in queue");
        this.code = 500;
    }
}

class Group {

    constructor(prefix = "") {
        this._routes = [];
        this._filters = [];
        this._groups = [];
        this._prefix = prefix;
    }
    handle(path, methods, requestListener, { name, comments, filters } = { name: "", comments: [], filters: [] }) {
        assert(typeof path === 'string')
        assert(methods instanceof Array)
        assert(requestListener instanceof Function)
        methods = methods.map((verb) => verb.toUpperCase());
        // If GET, add HEAD
        if (methods.includes("GET") && !methods.includes("HEAD")) {
            methods.push("HEAD");
        }
        // if it is a named function use the name
        // as route name
        if (name === "" || name === undefined) {
            name = [requestListener.name, methods.map(w => w.toLowerCase()).join('_')].join('_')
        }
        if (filters === undefined) {
            filters = []
        }
        this._routes.push({ path: path, methods, requestListener, name, comments, filters });
        return this
    }

    handleResource(prefixPath, resourceName, resourceHandler, { filters } = { filters: [] }) {

        assert(typeof resourceName === 'string', 'resourceName should be a string')
        assert(typeof prefixPath === 'string', 'prefixPath should be a string')
        assert(resourceHandler !== null, 'resource handler shouldn\'t be null')

        let resource = this.group(prefixPath)
        Object.defineProperty(resource, "resourceName", { get: function () { return resourceName } })
        if (typeof resourceHandler.configure === "function") {
            resourceHandler.configure(resource)
        }
        if (typeof resourceHandler.filter === "function") {
            resource.filter(context => resourceHandler.filter(context))
        }
        resource.filter(...filters)

        if (typeof resourceHandler.index === "function") {
            resource.handle("/", ["GET"], ctx => resourceHandler.index(ctx), { name: resourceName + "_index" })
        }
        if (typeof resourceHandler.post === "function") {
            resource.handle("/", ["POST"], ctx => resourceHandler.post(ctx), { name: resourceName + "_post" })
        }
        if (typeof resourceHandler.get === "function") {
            resource.handle("/:" + resourceName, ["GET"], ctx => resourceHandler.get(ctx), { name: resourceName + "_get" })
        }
        if (typeof resourceHandler.put === "function") {
            resource.handle("/:" + resourceName, ["PUT"], ctx => resourceHandler.put(ctx), { name: resourceName + "_put" })
        }
        if (typeof resourceHandler.patch === "function") {
            resource.handle("/:" + resourceName, ["PATCH"], ctx => resourceHandler.patch(ctx), { name: resourceName + "_patch" })
        }
        if (typeof resourceHandler.delete === "function") {
            resource.handle("/:" + resourceName, ["DELETE"], ctx => resourceHandler.delete(ctx), { name: resourceName + "_delete" })
        }
        if (typeof resourceHandler.options === "function") {
            resource.handle("/:" + resourceName, ["OPTIONS"], ctx => resourceHandler.options(ctx), { name: resourceName + "_options" })
        }
        return this
    }

    filter(...filters) {
        this._filters.push(...filters);
        return this
    }
    group(prefix = "/") {
        let group = new Group(prefix)
        this._groups.push(group)
        return group
    }

    routes() {
        let routes = this._routes.map(route => {

            route.path = pathJoin(this._prefix, route.path)
            route.filters.unshift(...this._filters)
            return route
        })
        return this._groups.reduce((routes, group) => {
            return routes.concat(...group.routes().map(route => {
                route.path = pathJoin(this._prefix, route.path)
                route.filters.unshift(...this._filters)
                return route
            }))
        }, routes)
    }

}

class App {
    constructor(prefix = "/") {
        this._routes = [];
        this._filters = [];
        this._group = new Group(prefix)
        this._routeCache = null
    }
    handle(path, methods, requestListener, { name, comments, filters } = { name: path, comments: [], filters: [] }) {
        return this._group.handle(path, methods, requestListener, { name, comments, filters })
    }
    handleResource(prefixPath, resourceName, resourceHandler) {
        return this._group.handleResource(prefixPath, resourceName, resourceHandler)
    }
    filter(...filters) {
        return this._group.filter(...filters)
    }
    group(prefix = "/") {
        return this._group.group(prefix)
    }
    routes() {
        if (this._routeCache === null) {
            this._routeCache = this._group.routes().map(r => {
                r.path = stripSuffix(r.path, '/')
                return r
            })
        }
        return this._routeCache
    }
    match(request) {
        return this.routes().find((route) => {
            const params = {};
            // if method not supported, exit
            if (!route.methods.includes(request.method)) {
                return false;
            }
            const parsedURL = url.parse(request.url, true);

            let path = parsedURL.pathname;

            // simplest case
            if (path === "/" && route.path === path) {
                return true;
            }
            // remove extra / at the end if present
            if (path.endsWith("/")) {
                path = path.substr(0, path.length - 1);
            }
            const routeParts = route.path.split("/");
            const pathParts = splitN(path, '/', routeParts.length)
            if (routeParts.length !== pathParts.length) {
                return false
            }
            for (let i = 0; i < routeParts.length; i++) {
                // if route variable, add to params
                if (routeParts[i].startsWith(":")) {
                    if (pathParts[i].includes("/")) {
                        if (routeParts[i].startsWith(':*') && i === (routeParts.length - 1)) {
                            params[routeParts[i]] = decodeURI(pathParts[i]);
                            break;
                        }
                        return false;
                    }
                    params[routeParts[i]] = decodeURIComponent(pathParts[i]);
                    continue;
                }
                // if string, compare parts
                if (routeParts[i] !== pathParts[i]) {
                    return false;
                }
            }
            request.query = Object.assign(parsedURL.query, params);
            Object.freeze(request.query);
            return true;
        });

    }


    static version() { return "0.0.0"; }


    get requestListener() {

        return (request, response) => {
            // match routes
            let route = this.match(request);
            // if no match 404
            if (!route) {
                response.statusCode = 404;
                response.end(http.STATUS_CODES[404]);
                return;
            }
            // get  all filters and end the chain with the route handler
            let chain = route.filters.concat([route.requestListener]);
            let context = {
                get currentRoute() {
                    return route
                },
                get request() {

                    return request;
                },
                get response() {
                    return response;
                },
                get next() {
                    return function (err) {
                        if (err) {
                            return Promise.reject(err).catch(error)
                        }
                        if (chain.length > 0) {
                            let handler = chain.shift();
                            return Promise.resolve(handler(context)).catch(error)
                        }
                        return Promise.reject(new NextError).catch(error)
                    };
                }
            };
            function error(error) {
                console.log(error);
                if (error.status === undefined) {
                    error.status = 500;
                }
                if (!response.headerSent) {
                    response.statusCode = error.status;
                    response.end(http.STATUS_CODES[error.status]);
                }

            }
            // call the first handler in the chain
            // subsequent handlers need to be called manually with context.next()
            // which returns a promise
            return context.next()
        };
    }
}


const connect = function (middleware) {
    return function (context) {
        return new Promise(function (resolve, reject) {
            middleware(context.request, context.response, function (err) {
                if (err) {
                    return reject(context.next(err))
                }
                resolve(context.next())
            })
        })

    }
}

const promise = function (method, ...args) {
    return new Promise(function (resolve, reject) {
        method = method.bind(null, ...args)
        method(function (err, result) {
            if (err) {
                return reject(err);
            }
            resolve(result);
        });
    });
};

module.exports = { NextError, App, promise, connect, splitN };