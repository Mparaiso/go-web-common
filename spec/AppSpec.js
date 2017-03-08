/* eslint-env jasmine */
const weeboo = require('../app')

describe('splitN', function () {
    let table = [
        { args: ['foo/bar/baz', '/', 0], expectedResult: ['foo/bar/baz'] },
        { args: ['foo/bar/baz', '/', 1], expectedResult: ['foo/bar/baz'] },
        { args: ['foo/bar/baz', '/', 2], expectedResult: ['foo', 'bar/baz'] },
        { args: ['foo/bar/baz', '/', 3], expectedResult: ['foo', 'bar', 'baz'] },
        { args: ['foo/bar/baz', '/', 4], expectedResult: ['foo', 'bar', 'baz'] },
        { args: ['foo//bar/baz', '/', 3], expectedResult: ['foo', '', 'bar/baz'] },
        { args: ['/foo/bar/baz', '/', 3], expectedResult: ['', 'foo', 'bar/baz'] },
        { args: ['/foo/bar/baz', '/', 6], expectedResult: ['', 'foo', 'bar', 'baz'] }
    ]
    for (let { args, expectedResult } of table) {
        describe('when splitN is called ', function () {
            let result = weeboo.splitN(...args)
            it('it should return the right result', function () {
                expect(result).toEqual(expectedResult)
            })
        })
    }
})

describe('weeboo.App', function () {
    beforeEach(function () {
        this.app = new weeboo.App
        this.app.handle('/hello', ['GET'], (context) => context.response.end('OK'), { name: 'hello' })
        this.app.handle('/product/:product_id', ["GET"], context => context.reponse.end(context.request.query[':product_id']), { name: 'get_product' })
        this.app.handle('/files/:*file', ['GET'], context => context.reponse.end(context.request.query[':*file']), { name: 'serve_files' })
    })
    describe("app.match", function () {
        describe('When request is not matched', function () {
            let request = { method: "GET", url: "http://localhost:8080/unknown" }
            it('It should return undefined', function () {
                let route = this.app.match(request)
                expect(route).toBeUndefined()
            })
        })
        describe('When a request matches an existing route path with the wrong method', function () {
            let request = { method: "POST", url: "http://localhost:8080/hello" }
            it('It should return undefined', function () {
                let route = this.app.match(request)
                expect(route).toBeUndefined(request)
            })
        })
        describe('When a request is matched', function () {
            let request = { method: "GET", url: "http://localhost:8080/hello" }
            it('should return the right route', function () {
                let route = this.app.match(request)
                expect(route.name).toBe('hello')
            })
        })

        describe('When a request matches a route with variables', function () {
            let request = { method: "GET", url: "http://localhost:8080/product/9999" }
            it('should return the right route and the right query object', function () {
                let route = this.app.match(request)
                expect(route.name).toBe('get_product')
                expect(request.query[':product_id']).toEqual("9999")
            })
        })
        describe('When a request matches a route with a wild card', function () {
            let request = { method: 'GET', url: 'http://localhost:8080/files/folder/image.png' }
            it('should return the right route and the rigth query object', function () {
                let route = this.app.match(request)
                expect(route).not.toBeUndefined()
                expect(route.name).toBe('serve_files')
                expect(request.query[':*file']).toEqual('folder/image.png')
            })
        })
    })
})