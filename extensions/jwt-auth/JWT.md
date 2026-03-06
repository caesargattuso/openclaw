1.获取skill对应的JWT

请求路径
正式环境：https://toca.17u.cn/open-api/auth/openclaw-jwt
测试环境: https://toca.qa.17u.cn/open-api/auth/openclaw-jwt
请求方式
POST
接口描述
获取skil对应的jwt

请求参数
body
字段名称
数据类型
是否必填
字段说明
userId
string
是
管家侧用户ID
spaceId
string
是
管家侧空间ID
skillName
string
是
skill名称
expireMinutes
Long
否
JWT有效期。单位为分钟。支持自定义时间。默认过期时间60分钟
请求示例

{
    "spaceId":"0583d",
    "userId":"175199440840269824",
    "skillName":"zyx-test"
}
响应示例
{
    "data": {
        "jwt": "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1XzE4NjkzNzE5MzA4ODk0NTM2NDAiLCJ1c2VySWQiOiJ1XzE4NjkzNzE5MzA4ODk0NTM2NDAiLCJzcGFjZUlkIjoic3BfYTFiMmMzZDRlNWY2IiwiZW1wbG95ZWVObyI6IkVNUDEyMzQ1IiwibWVtYmVyTmFtZSI6IuW8oOS4iSIsIm1lbWJlcklkIjoibV85ODc2NTQzMjEiLCJza2lsbE5hbWUiOiJob3RlbC1ib29raW5nLXNraWxsIiwiaWF0IjoxNzQxMDk2MDAwLCJleHAiOjE3NDExMDMyMDB9.SIGNATURE_PLACEHOLDER",
        "expiresIn": 7200
    },
    "success": true,
    "code": 200,
    "requestId": "6a581cad-3187-446e-bd5d-2b598c40a2c3"
}


{
    "success": false,
    "code": 10000,
    "message":"xxxx"
    "requestId": "6a581cad-3187-446e-bd5d-2b598c40a2c3"
}
响应参数
字段名称
数据类型
是否一定会有值
字段说明
jwt
string
是
jwt
expiresIn
string
是
JWT有效期。单位为秒

2.获取JWT验证使用的公钥

请求路径
正式环境：https://toca.17u.cn/open-api/auth/openclaw-jwt/public-key
测试环境: https://toca.qa.17u.cn/open-api/auth/openclaw-jwt/public-key
请求方式
GET
接口描述
获取skil对应的jwt

请求参数
query
字段名称
数据类型
是否必填
字段说明
skillName
string
是
skill名称
请求示例

https://toca.17u.cn/open-api/auth/openclaw-jwt?skillName=xxxxx
响应示例
{
    "data": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjM2C7DNFQ/KrHVy0n0/x\nxPXVrkc4QZQXlbBd9LwaBYGiwS1UQr/2GmIoCmxdbFhOUIxmTYrjsJV4yQOQNrAf\nUxXzibG04YtUZQE2JHRYYAISsCojQ5wB84X6apVFDrq4rKlavjqHnTf3muxzVHlq\nv7JRbo2GFt3N5q70D8yPZGq2sMuSwy3L2zCdRAQPhmqd8zb5ABR0CsE5hvChCWo7\nWh0TgltolTJBaiVduiI1x2OxRjPCsyE/+cJlJrp76WXziTuO/tLw7jYSp+2dDjUU\n2A2ukcsoMUwwtSKu0n4sdlaRVM19pDpkR6TWAsTR1Z6DBcwDFpuCPXs5p/EBZVTv\nSwIDAQAB\n-----END PUBLIC KEY-----\n",
    "success": true,
    "code": 200,
    "requestId": "616f34db-57db-4989-bd49-d002fe45eacd"
}

{
    "success": false,
    "code": 10000,
    "message":"xxxx"
    "requestId": "6a581cad-3187-446e-bd5d-2b598c40a2c3"
}

响应参数
字段名称
数据类型
是否一定会有值
字段说明
data
string
是
对应的公钥


三、Java验证JWT代码示例

1. pom.xml
 <!--jjwt-->
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-api</artifactId>
            <version>0.12.6</version>
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-impl</artifactId>
            <version>0.12.6</version>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-jackson</artifactId>
            <version>0.12.6</version>
            <scope>runtime</scope>
        </dependency>


2. 相关代码

public static void main(String[] args) throws Exception {
        // 1. 测试密钥对生成
        String jwt = "eyJhbGciOiJSUzI1NiJ9.eyJza2lsbE5hbWUiOiJ6eXgtdGVzdCIsInN1YiI6IjE3NTE5OTQ0MDg0MDI2OTgyNCIsInNwYWNlSWQiOiIwNTgzZCIsIm1lbWJlck5hbWUiOiLlvKDlrofovakiLCJlbXBsb3llZU5vIjoiMTIwNjEzMSIsInVzZXJJZCI6IjE3NTE5OTQ0MDg0MDI2OTgyNCIsIm1lbWJlcklkIjoieXV4dWFuLnpoYW5nIiwiaWF0IjoxNzcyNzA4MTg1LCJleHAiOjE3NzI3MTE3ODV9.chn0ub5ngkKQtF3xWXjy_pxm6j4RwHDcxHuvL956tBVHjcQMjE4zgRjZMYXGSdJF4Y1s4TJlC4dqSByptArpMf1InYDZ-ZNRt32E0Mt3BVbx_V20qsevlXCkNwiRFsn50jJZQogaeF1IwKv3jav2tKD7XA9SfbdZGec86ZWC8petHVrx6eNCHKorux6zxVXQJZgXhRT3vy0rGLPz57zW305obqDXb0mdbmS3c2k5nIV342eDx-2QiqIEro7n7RCLpt-8bsNikZlAvDClOIx6-R1eN9sPgOztngEldReOiTuRSmvn3kSHxSK8MLbeT-E_vGJH_i7uOCWeZ1lBUr8HvQ"; // TODO: 在此处填写你的 JWT 字符串
        String publicKeyPem = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjM2C7DNFQ/KrHVy0n0/x\nxPXVrkc4QZQXlbBd9LwaBYGiwS1UQr/2GmIoCmxdbFhOUIxmTYrjsJV4yQOQNrAf\nUxXzibG04YtUZQE2JHRYYAISsCojQ5wB84X6apVFDrq4rKlavjqHnTf3muxzVHlq\nv7JRbo2GFt3N5q70D8yPZGq2sMuSwy3L2zCdRAQPhmqd8zb5ABR0CsE5hvChCWo7\nWh0TgltolTJBaiVduiI1x2OxRjPCsyE/+cJlJrp76WXziTuO/tLw7jYSp+2dDjUU\n2A2ukcsoMUwwtSKu0n4sdlaRVM19pDpkR6TWAsTR1Z6DBcwDFpuCPXs5p/EBZVTv\nSwIDAQAB\n-----END PUBLIC KEY-----\n";

        // 2. 解析公钥
        PublicKey publicKey = JwtUtils.parsePublicKey(publicKeyPem);

        // 3. 验证并解析 JWT（jjwt 0.12.6 新 API）
        Claims claims = Jwts.parser()
                .verifyWith(publicKey)
                .build()
                .parseSignedClaims(jwt)
                .getPayload();

        // 4. 打印解析结果
        System.out.println("JWT Claims: " + claims);


        }

         public static PublicKey parsePublicKey(String pem) throws IOException {
        try (PEMParser parser = new PEMParser(new StringReader(pem))) {
            Object pemObject = parser.readObject();
            JcaPEMKeyConverter converter = new JcaPEMKeyConverter();

            if (pemObject instanceof SubjectPublicKeyInfo) {
                return converter.getPublicKey((SubjectPublicKeyInfo) pemObject);
            }
            throw new IllegalArgumentException("不支持的公钥格式: " + pemObject.getClass().getName());
        }
    }


JWT Claims: {skillName=zyx-test, sub=175199440840269824, spaceId=0583d, memberName=张宇轩, employeeNo=1206131, userId=175199440840269824, memberId=yuxuan.zhang, iat=1772708185, exp=1772711785}
