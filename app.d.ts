import http = require("http");

/**
 * a route is a request handler 
 * registered in the application
 */
interface route {
    name: string;
    path: string;
    requestListener: requestListener;
}
/**
 * context is the request context
 */
interface context {
    request: http.IncomingMessage;
    response: http.ServerResponse;
    next: next;
    currentRoute: route;
    [property: string]: any;

}

/**
 * a request listener 
 * handles resources in a restful 
 * fashion
 */
interface RequestListener {
    configure(group: Group)
    filter(context: context)
    get(context: context)
    list(context: context)
    put(context: context)
    patch(context: context)
    post(context: context)
    delete(context: context)
}

type next = (err?: Error) => void;
type requestListener = (context: context) => (void | Promise<any>);

/**
 * NextError is yielded when no more handlers are
 * in queue and next is called
 */
export class NextError extends Error { }

export class Group {
    handle(path: string, method: string[], requestListener: requestListener, options?: {}): this;
    handleResource(path: string, resourceName: string, resourceHandler: ResourceHandler): this;
    filter(...requestListener: requestListener): this;
    group(prefix: string): Group
    routes(): route[]
}
/**
 * App is a http router for nodejs based on promises
 * and async functions.
 * @todo a filter need to be applied before and after a request, find a good way to do that
 */
export class App {
    constructor();
    /**
     * handle registers a new route in the application
     */
    handle(path: string, method: string[], requestListener: requestListener, options?: {}): Group;
    handleResource(path: string, resourceName: string, resourceHandler: ResourceHandler): Group;
    /**
     * match matches a request against registered routes 
     */
    match(request: http.IncomingMessage): route;
    /**
     * filter registers a new filter in the application.
     * Filters are executed before the main handler
     */
    filter(...requestListener: requestListener): Group;
    /**
     * routes return the application routes
     */
    routes(): route[];
    /**
     * version returns the application version
     */
    static version(): string;
    /**
     * returns a request listener that can be used 
     * with an http.Server
     */
    requestListener: (request: http.IncomingMessage, response: http.ServerResponse) => Promise;
    private _route: route[];
    private _filter: requestListener[];
}

/**
 * connect adapts a connect middlware and returns a filter
 */
export function connect(middleware: (request: http.IncomingMessage, response: http.ServerResponse, next: (err: Error) => void) => void): requestListener

/**
 * splitN splits a string by separator until length results.
 * The last result holds the remaining of the string
 */
export function splitN(string: string, separator: string, length: number): string[]