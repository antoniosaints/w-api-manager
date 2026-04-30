import os from 'node:os';
import path from 'node:path';

const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
process.env.WAPI_DB_PATH ||= path.join(os.tmpdir(), `wapi-test-${suffix}.sqlite`);
process.env.WAPI_UPLOAD_DIR ||= path.join(os.tmpdir(), `wapi-uploads-${suffix}`);
process.env.WAPI_BASE_URL ||= 'https://api.example.test';
process.env.WAPI_INSTANCE_ID ||= 'instance-test';
process.env.WAPI_TOKEN ||= 'token-test';
