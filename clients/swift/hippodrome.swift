//
//  hippodrome.swift
//
//  Created by John O'Sullivan on 3/31/18.
//  Copyright © 2018 John O'Sullivan. All rights reserved.
//

import Foundation
import SocketIO

enum HttpMethod : String {
    case  GET
    case  POST
    case  DELETE
    case  PUT
}

class HttpClientApi: NSObject{

    var request : URLRequest?
    var session : URLSession?

    static func instance() ->  HttpClientApi{ return HttpClientApi() }

    func makeAPICall(url: String,params: Dictionary<String, Any>?, method: HttpMethod, auth: String, success:@escaping ( Data? ,HTTPURLResponse?  , NSError? ) -> Void, failure: @escaping ( Data? ,HTTPURLResponse?  , NSError? )-> Void) {

        request = URLRequest(url: URL(string: url)!)
        print("URL = \(url)")

        if let params = params {
            let  jsonData = try? JSONSerialization.data(withJSONObject: params, options: .prettyPrinted)
            request?.setValue("application/json", forHTTPHeaderField: "Content-Type")

            if (auth != "") { request?.setValue(auth, forHTTPHeaderField: "Authorization") }
            if (method != .GET) { request?.httpBody = jsonData }

        }
        request?.httpMethod = method.rawValue

        let configuration = URLSessionConfiguration.default

        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 30

        session = URLSession(configuration: configuration)
        session?.dataTask(with: request! as URLRequest) { (data, response, error) -> Void in
            if let data = data {
                if let response = response as? HTTPURLResponse, 200...299 ~= response.statusCode {
                    success(data , response , error as NSError?)
                } else {
                    failure(data , response as? HTTPURLResponse, error as NSError?)
                }
            } else {
                failure(data , response as? HTTPURLResponse, error as NSError?)
            }
        }.resume()
    }

}

class hippodrome: NSObject {

    static let sharedInstance = hippodrome()

    static let base_endpoint = "http://localhost:3000"
    static let auth_endpoint = base_endpoint + "/api/auth/authenticate"
    static let readySession_endpoint = base_endpoint + "/api/readyForSession"

    var socket = SocketIOClient(socketURL: URL(string: base_endpoint)!, config: [.log(true), .compress])
    var session_auth_token = ""
    var rand_user = ""
    var session_id = ""
    var function_name = ""

    override init() {
        super.init()

        socket.on(clientEvent: .connect) {data, ack in
            print("socket connection -> \(data)")

            self.socket.emit("confirmedSession", ["token":self.session_auth_token,"rand_user":self.rand_user])
        }
        /*
        socket.on("test_ping_rec") {data, ack in
            print("test_ping_rec -> \(data)")
        }

        socket.on(clientEvent: .connect) {data, ack in
            print("socket connection -> \(data)")
        }
        */

    }

    func randSub(completionHandler: @escaping (_ data: Any) -> Void) {
        socket.on(self.rand_user) {data, ack in
            print("rand_user -> \(data)")
            if let arr = data as? [[String: Any]] {
                let type = arr[0]["type"] as? String
                self.function_name = (arr[0]["function_name"] as? String)!
                self.session_id = (arr[0]["type"] as? String)!
                print(type!)
                print(self.function_name)
                print(self.session_id)
                self.socket.on(self.function_name) {data, ack in
                    print("function_name -> \(data)")
                    completionHandler(data);
                }
            }
        }
    }

    func send_frame() {
        self.socket.emit("send_frame", ["payload":"safhjhsaghjsadgjhsagfasj","function_name":self.function_name,"session_id":self.session_id])
    }

    func leaveSession() {
        self.socket.emit("leaveSession", ["token":self.session_auth_token,"rand_user":self.rand_user,"session_id":self.session_id])
    }

    func readyForSession(completionHandler: @escaping (_ data: Any) -> Void) {

        let auth_token = "Bearer " + session_auth_token
        let paramsDictionary = [String:Any]()

        HttpClientApi.instance().makeAPICall(url: hippodrome.readySession_endpoint, params:paramsDictionary, method: .GET,auth: auth_token, success: { (data, response, error) in
            do {
                let json = try JSONSerialization.jsonObject(with: (data as Data?)!, options: []) as! [String: AnyObject]
                print(json)
                let rand_user = json["rand_user"] as! String
                self.rand_user = rand_user
                self.randSub(completionHandler: completionHandler)
                self.socket.connect()
            } catch let error as NSError {
                print("Failed: \(error.localizedDescription)")
                completionHandler("")
            }
        }, failure: { (data, response, error) in
            print(response as Any)
            completionHandler("")
        })

        completionHandler(session_auth_token)
    }

    func authenticate(username: String, password: String, completionHandler: @escaping (_ sucess: Bool) -> Void) {
        var paramsDictionary = [String:Any]()
        paramsDictionary["username"] = username
        paramsDictionary["password"] = password

        HttpClientApi.instance().makeAPICall(url: hippodrome.auth_endpoint, params:paramsDictionary, method: .POST,auth: "", success: { (data, response, error) in
            do {
                let json = try JSONSerialization.jsonObject(with: (data as Data?)!, options: []) as! [String: AnyObject]
                let token = json["token"] as! String
                self.session_auth_token = token;
                completionHandler(true)
            } catch let error as NSError {
                print("Failed: \(error.localizedDescription)")
                completionHandler(false)
            }
        }, failure: { (data, response, error) in
            print(response as Any)
            completionHandler(false)
        })
    }

    func configure() {

    }

}
