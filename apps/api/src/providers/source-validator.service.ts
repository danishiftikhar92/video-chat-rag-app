import { BadRequestException, Injectable } from '@nestjs/common';
import { URL } from 'node:url';

@Injectable()
export class SourceValidatorService {
  constructor(private readonly allowedHosts: string[]) {}

  validate(urlString: string): URL {
    let parsed: URL;

    try {
      parsed = new URL(urlString);
    } catch {
      throw new BadRequestException('Invalid source URL');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Only http/https sources are allowed');
    }

    const host = parsed.hostname.toLowerCase();
    const isAllowed = this.allowedHosts.some((allowedHost) =>
      host === allowedHost || host.endsWith(`.${allowedHost}`)
    );

    if (!isAllowed) {
      throw new BadRequestException(`Source host ${host} is not allowed`);
    }

    if (host === 'localhost' || host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.')) {
      throw new BadRequestException('Private or loopback hosts are not allowed');
    }

    return parsed;
  }
}
