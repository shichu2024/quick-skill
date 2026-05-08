export class InitError extends Error {
  code: string;
  userMessage: string;

  constructor(code: string, userMessage: string) {
    super(userMessage);
    this.code = code;
    this.userMessage = userMessage;
    this.name = 'InitError';
  }
}

export class PermissionError extends InitError {
  constructor(userMessage: string = '当前工作目录无读写权限，请检查目录权限') {
    super('PERMISSION_ERROR', userMessage);
    this.name = 'PermissionError';
  }
}

export class SkillSourceEmptyError extends InitError {
  constructor(userMessage: string = 'CLI内部Skill源为空，请联系维护者') {
    super('SKILL_SOURCE_EMPTY', userMessage);
    this.name = 'SkillSourceEmptyError';
  }
}

export class DeployIoError extends InitError {
  constructor(userMessage: string, originalError?: Error) {
    super('DEPLOY_IO_ERROR', userMessage);
    this.name = 'DeployIoError';
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

export class UserCancelledError extends InitError {
  constructor(userMessage: string = '用户取消操作') {
    super('USER_CANCELLED', userMessage);
    this.name = 'UserCancelledError';
  }
}