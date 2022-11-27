/**
 * Created by housisong on 2021.04.07.
 */
#include <node.h>
#include <node_buffer.h>
#include <cstdlib>
#include <string>
#include "hdiff.h"

using namespace std;

namespace hdiffpatchNode
{
    using v8::FunctionCallbackInfo;
    using v8::HandleScope;
    using v8::Isolate;
    using v8::Local;
    using v8::Context;
    using v8::Object;
    using v8::String;
    using v8::Value;
    using v8::Function;
    using v8::MaybeLocal;
    using v8::Null;
    using v8::Boolean;
    using v8::Exception;

    struct DiffStreamOpaque {
        Isolate* isolate;
        Local<Function> cb;
    };

    static int callback_write(DiffStreamOpaque* opaque, const void* buffer, size_t size)
    {
        Local<Context> context = opaque->isolate->GetCurrentContext();
        Local<Object> returnObj = node::Buffer::Copy(opaque->isolate, (const char*)buffer, size).ToLocalChecked();
        Local<Value> argv[1] = { returnObj };
        (void) opaque->cb->Call(context, Null(opaque->isolate), 1, argv);
        return 0;
    }

    void diff(const FunctionCallbackInfo<Value>& args) {
        Isolate* isolate = args.GetIsolate();
        HandleScope scope(isolate);

        if (!node::Buffer::HasInstance(args[0]) || !node::Buffer::HasInstance(args[1]) || !args[2]->IsFunction()) {
            isolate->ThrowException(Exception::TypeError(
                v8::String::NewFromUtf8(isolate, "Invalid arguments.", v8::NewStringType::kNormal).ToLocalChecked()
            ));
        }

        char*   oldData   = node::Buffer::Data(args[0]);
        size_t  oldLength = node::Buffer::Length(args[0]);
        char*   newData   = node::Buffer::Data(args[1]);
        size_t  newLength = node::Buffer::Length(args[1]);

        DiffStreamOpaque streamOpaque;
        streamOpaque.isolate = isolate;
        streamOpaque.cb = Local<Function>::Cast(args[2]);

        std::vector<uint8_t> codeBuf;
        try {
            hdiff((const uint8_t*)oldData,oldLength,(const uint8_t*)newData,newLength,codeBuf);
        } catch(const std::exception& e) {
            std::string errInfo("Create hdiff failed : "); errInfo+=e.what();
            isolate->ThrowException(Exception::TypeError(
                v8::String::NewFromUtf8(isolate, errInfo.c_str(), v8::NewStringType::kNormal).ToLocalChecked()
            ));
        }

        if (0!=callback_write(&streamOpaque,codeBuf.data(),codeBuf.size())) {
            isolate->ThrowException(Exception::TypeError(
                v8::String::NewFromUtf8(
                    isolate, "Create hdiff failed : Write data to DiffStreamOpaque fail.", v8::NewStringType::kNormal
                ).ToLocalChecked()
            ));
        }

        // args.GetReturnValue().Set(returnObj);
        // args.GetReturnValue().Set(String::NewFromUtf8(isolate, bufferData, String::kNormalString, bufferLength));
    }

    void init(Local<Object> exports)
    {
        Isolate* isolate = exports->GetIsolate();
        HandleScope scope(isolate);
        NODE_SET_METHOD(exports, "diff", diff);
    }

    NODE_MODULE(hdiffpatch, init)

} // namespace hdiffpatch
