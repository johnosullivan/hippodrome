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

class HttpClientAPI: NSObject{

    var request : URLRequest?
    var session : URLSession?

    static func instance() ->  HttpClientAPI{ return HttpClientAPI() }

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

    static let session_found = "JOIN_SESSION_FOUND"

    var socket = SocketIOClient(socketURL: URL(string: base_endpoint)!, config: [.log(true), .compress])
    var session_auth_token = ""
    var rand_user = ""
    var session_id = ""
    var function_name = ""

    var completionFrameHandler: (Any) -> Void?
    var completionSessionHandler: (Any) -> Void?

    override init() {
        //super.init()

        let temp_handler: (Any) -> Void = { success in

        }
        self.completionFrameHandler = temp_handler;
        self.completionSessionHandler = temp_handler;
    }

    func configure() {
        socket.on(clientEvent: .connect) {data, ack in
            print("socket connection -> \(data)")
            self.socket.emit("confirmedSession", ["token":self.session_auth_token,"rand_user":self.rand_user])
        }
    }

    func playerPubSub(handler: @escaping (_ data: Any) -> Void) {
        self.completionSessionHandler = handler
        socket.on(self.rand_user) {data, ack in

            if let arr = data as? [[String: Any]] {
                let type = arr[0]["type"] as? String
                print(type!)

                if (type! == "JOIN_SESSION_FOUND") {
                    self.function_name = (arr[0]["function_name"] as? String)!
                    self.session_id = (arr[0]["session_id"] as? String)!
                    print(self.function_name)
                    print(self.session_id)
                    self.socket.on(self.function_name) {data, ack in
                        self.completionFrameHandler(data);
                    }
                } else {
                    self.completionSessionHandler(data);
                }


            }

        }
    }

    func sessionPrestartConfirm() {
        self.socket.emit("sessionPrestartConfirm", ["token": self.session_auth_token])
    }

    func completedRound(results: Any) {
        self.socket.emit("completedRound", ["token": self.session_auth_token, "results": results])
    }

    func playerReady() {
        // Sends the frame to the session with its players
        self.socket.emit("playerReady", ["token": self.session_auth_token])
    }

    func sendFrame(payload: Any) {
        // Sends the frame to the session with its players
        self.socket.emit("sendFrame", ["payload": payload, "function_name": self.function_name, "session_id": self.session_id])
    }

    func leaveSession() {
        // Leaves the current session in play
        self.socket.emit("leaveSession", ["token": self.session_auth_token,  "rand_user": self.rand_user, "session_id": self.session_id])
    }

    func readyForSession(completionHandler: @escaping (_ data: Any) -> Void) {
        // Preparing the headers
        let auth_token = "Bearer " + session_auth_token
        let paramsDictionary = [String:Any]()
        // HttpClientAPI makes the API readyForSession call to the server
        HttpClientAPI.instance().makeAPICall(url: hippodrome.readySession_endpoint, params:paramsDictionary, method: .GET,auth: auth_token, success: { (data, response, error) in
            do {
                let json = try JSONSerialization.jsonObject(with: (data as Data?)!, options: []) as! [String: AnyObject]
                self.rand_user = json["rand_user"] as! String
                self.playerPubSub(handler: completionHandler)
                self.socket.connect()
            } catch let error as NSError {
                print("Failed: \(error.localizedDescription)")
            }
        }, failure: { (data, response, error) in
            print(response as Any)
        })
    }

    func authenticate(username: String, password: String, completionHandler: @escaping (_ sucess: Bool) -> Void) {
        // Preparing the authenticate API call
        var paramsDictionary = [String:Any]()
        paramsDictionary["username"] = username
        paramsDictionary["password"] = password
        // HttpClientAPI makes the API authenticate call to the server
        HttpClientAPI.instance().makeAPICall(url: hippodrome.auth_endpoint, params:paramsDictionary, method: .POST,auth: "", success: { (data, response, error) in
            do {
                let json = try JSONSerialization.jsonObject(with: (data as Data?)!, options: []) as! [String: AnyObject]
                self.session_auth_token = json["token"] as! String
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
}
