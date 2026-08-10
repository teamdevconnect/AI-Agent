// import { HttpService } from '@nestjs/axios';
// import { BadRequestException, Injectable } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { firstValueFrom } from 'rxjs';

// export type OAuthProviderName = 'google' | 'microsoft' | 'github';

// export interface OAuthProfile {
//   providerId: string;
//   email: string;
//   name: string;
// }

// interface ProviderConfig {
//   clientId: string;
//   clientSecret: string;
//   redirectUri: string;
// }

// /**
//  * "Sign in with ..." for Google, Microsoft, and GitHub — hand-rolled
//  * authorize-URL/token-exchange/profile-fetch, same shape as
//  * gmail.service.ts/outlook.service.ts's mailbox-connect flow, just against
//  * each provider's login (not mailbox-delegation) scopes, and returning a
//  * normalized profile instead of persisting a connection doc. Kept as plain
//  * HTTP calls rather than passport strategies because this app is stateless
//  * JWT end to end (see AuthModule's PassportModule.register({defaultStrategy:
//  * 'jwt'})) — passport's OAuth strategies assume a session to round-trip
//  * through, which this app deliberately has none of.
//  */
// @Injectable()
// export class OAuthService {
//   constructor(
//     private config: ConfigService,
//     private http: HttpService,
//   ) {}

//   private providerConfig(provider: OAuthProviderName): ProviderConfig {
//     const cfg = this.config.get<ProviderConfig>(`oauth.${provider}`);
//     if (!cfg?.clientId) {
//       throw new BadRequestException(`${provider} sign-in is not configured`);
//     }
//     return cfg;
//   }

//   buildAuthorizeUrl(provider: OAuthProviderName, state: string): string {
//     const { clientId, redirectUri } = this.providerConfig(provider);

//     if (provider === 'google') {
//       const params = new URLSearchParams({
//         client_id: clientId,
//         redirect_uri: redirectUri,
//         response_type: 'code',
//         scope: 'openid email profile',
//         state,
//       });
//       return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
//     }

//     if (provider === 'microsoft') {
//       const tenant = this.config.get<string>('oauth.microsoft.tenant') ?? 'common';
//       const params = new URLSearchParams({
//         client_id: clientId,
//         redirect_uri: redirectUri,
//         response_type: 'code',
//         scope: 'openid profile email User.Read',
//         state,
//       });
//       return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
//     }

//     const params = new URLSearchParams({
//       client_id: clientId,
//       redirect_uri: redirectUri,
//       scope: 'read:user user:email',
//       state,
//     });
//     return `https://github.com/login/oauth/authorize?${params.toString()}`;
//   }

//   exchangeCodeForProfile(provider: OAuthProviderName, code: string): Promise<OAuthProfile> {
//     if (provider === 'google') return this.googleProfile(code);
//     if (provider === 'microsoft') return this.microsoftProfile(code);
//     return this.githubProfile(code);
//   }

//   private async googleProfile(code: string): Promise<OAuthProfile> {
//     const { clientId, clientSecret, redirectUri } = this.providerConfig('google');
//     const body = new URLSearchParams({
//       client_id: clientId,
//       client_secret: clientSecret,
//       code,
//       redirect_uri: redirectUri,
//       grant_type: 'authorization_code',
//     });
//     const { data: tokens } = await firstValueFrom(
//       this.http.post<{ access_token: string }>('https://oauth2.googleapis.com/token', body.toString(), {
//         headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//       }),
//     );
//     const { data: profile } = await firstValueFrom(
//       this.http.get<{ sub: string; email: string; name?: string }>('https://www.googleapis.com/oauth2/v3/userinfo', {
//         headers: { Authorization: `Bearer ${tokens.access_token}` },
//       }),
//     );
//     return { providerId: profile.sub, email: profile.email, name: profile.name ?? profile.email };
//   }

//   private async microsoftProfile(code: string): Promise<OAuthProfile> {
//     const { clientId, clientSecret, redirectUri } = this.providerConfig('microsoft');
//     const tenant = this.config.get<string>('oauth.microsoft.tenant') ?? 'common';
//     const body = new URLSearchParams({
//       client_id: clientId,
//       client_secret: clientSecret,
//       code,
//       redirect_uri: redirectUri,
//       grant_type: 'authorization_code',
//       scope: 'openid profile email User.Read',
//     });
//     const { data: tokens } = await firstValueFrom(
//       this.http.post<{ access_token: string }>(
//         `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
//         body.toString(),
//         { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
//       ),
//     );
//     const { data: profile } = await firstValueFrom(
//       this.http.get<{ id: string; mail?: string; userPrincipalName: string; displayName: string }>(
//         'https://graph.microsoft.com/v1.0/me',
//         { headers: { Authorization: `Bearer ${tokens.access_token}` } },
//       ),
//     );
//     // Personal Microsoft accounts often have no `mail` (only a
//     // userPrincipalName that looks like an email) — work/school accounts
//     // usually have both, in which case `mail` is the real mailbox address.
//     const email = profile.mail ?? profile.userPrincipalName;
//     return { providerId: profile.id, email, name: profile.displayName ?? email };
//   }

//   private async githubProfile(code: string): Promise<OAuthProfile> {
//     const { clientId, clientSecret, redirectUri } = this.providerConfig('github');
//     const { data: tokens } = await firstValueFrom(
//       this.http.post<{ access_token?: string }>(
//         'https://github.com/login/oauth/access_token',
//         { client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri },
//         { headers: { Accept: 'application/json' } },
//       ),
//     );
//     if (!tokens.access_token) {
//       throw new BadRequestException('GitHub did not return an access token');
//     }

//     // GitHub's API rejects requests with no User-Agent header.
//     const headers = { Authorization: `Bearer ${tokens.access_token}`, 'User-Agent': 'HaiVE-App' };
//     const { data: profile } = await firstValueFrom(
//       this.http.get<{ id: number; login: string; name?: string; email?: string }>('https://api.github.com/user', {
//         headers,
//       }),
//     );

//     // GitHub only includes `email` on /user when the user made their primary
//     // email public; otherwise it's null and a second call is required.
//     let email = profile.email;
//     if (!email) {
//       const { data: emails } = await firstValueFrom(
//         this.http.get<Array<{ email: string; primary: boolean; verified: boolean }>>(
//           'https://api.github.com/user/emails',
//           { headers },
//         ),
//       );
//       email = emails.find((e) => e.primary && e.verified)?.email ?? emails.find((e) => e.verified)?.email;
//     }
//     if (!email) {
//       throw new BadRequestException('Your GitHub account has no verified email address');
//     }

//     return { providerId: String(profile.id), email, name: profile.name ?? profile.login };
//   }
// }


import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export type OAuthProviderName = 'google' | 'microsoft' | 'github';

export interface OAuthProfile {
  providerId: string;
  email: string;
  name: string;
}

interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

@Injectable()
export class OAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  private providerConfig(provider: OAuthProviderName): ProviderConfig {

    const cfg = this.config.get<ProviderConfig>(
      `oauth.${provider}`,
    );

    console.log('OAuth Provider:', provider);
    console.log('OAuth Config:', {
      clientId: cfg?.clientId ? 'loaded' : 'missing',
      clientSecret: cfg?.clientSecret ? 'loaded' : 'missing',
      redirectUri: cfg?.redirectUri,
    });


    if (!cfg?.clientId) {
      throw new BadRequestException(
        `${provider} OAuth client id missing`,
      );
    }

    if (!cfg?.clientSecret) {
      throw new BadRequestException(
        `${provider} OAuth secret missing`,
      );
    }

    if (!cfg?.redirectUri) {
      throw new BadRequestException(
        `${provider} OAuth redirect URI missing`,
      );
    }

    return cfg;
  }


  buildAuthorizeUrl(
    provider: OAuthProviderName,
    state: string,
  ): string {

    const {
      clientId,
      redirectUri,
    } = this.providerConfig(provider);


    // GOOGLE
    if (provider === 'google') {

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        response_mode: 'query',
        scope:
          'openid email profile',
        state,
      });


      return (
        'https://accounts.google.com/o/oauth2/v2/auth?' +
        params.toString()
      );
    }


    // MICROSOFT
    if (provider === 'microsoft') {

      const tenant =
        this.config.get<string>(
          'oauth.microsoft.tenant',
        ) || 'common';


      const params = new URLSearchParams({

        client_id: clientId,

        redirect_uri: redirectUri,

        response_type: 'code',

        response_mode: 'query',

        scope:
          'openid profile email User.Read',

        state,

        prompt:'select_account',

      });


      const url =
        `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;


      console.log(
        'Microsoft OAuth URL:',
        url,
      );


      return url;
    }



    // GITHUB

    const params = new URLSearchParams({

      client_id: clientId,

      redirect_uri: redirectUri,

      scope:
        'read:user user:email',

      state,

    });


    return (
      'https://github.com/login/oauth/authorize?' +
      params.toString()
    );
  }



  async exchangeCodeForProfile(
    provider: OAuthProviderName,
    code: string,
  ): Promise<OAuthProfile> {


    if(provider === 'google'){
      return this.googleProfile(code);
    }


    if(provider === 'microsoft'){
      return this.microsoftProfile(code);
    }


    return this.githubProfile(code);

  }




  private async microsoftProfile(
    code:string,
  ):Promise<OAuthProfile>{


    const {
      clientId,
      clientSecret,
      redirectUri,
    } = this.providerConfig(
      'microsoft'
    );


    const tenant =
      this.config.get<string>(
        'oauth.microsoft.tenant'
      ) || 'common';



    const body =
      new URLSearchParams({

        client_id:clientId,

        client_secret:clientSecret,

        code,

        redirect_uri:redirectUri,

        grant_type:
          'authorization_code',

        scope:
          'openid profile email User.Read',

      });



    const tokenResponse =
      await firstValueFrom(

        this.http.post<{
          access_token:string;
        }>(

          `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,

          body.toString(),

          {
            headers:{
              'Content-Type':
              'application/x-www-form-urlencoded',
            },
          }

        )

      );



    const graphResponse =
      await firstValueFrom(

        this.http.get<{

          id:string;

          mail?:string;

          userPrincipalName:string;

          displayName:string;

        }>(

          'https://graph.microsoft.com/v1.0/me',

          {
            headers:{
              Authorization:
              `Bearer ${tokenResponse.data.access_token}`,
            },
          }

        )

      );



    const profile =
      graphResponse.data;



    return {

      providerId:
        profile.id,

      email:
        profile.mail ??
        profile.userPrincipalName,

      name:
        profile.displayName,

    };

  }



  private async googleProfile(
    code:string,
  ):Promise<OAuthProfile>{

    const {
      clientId,
      clientSecret,
      redirectUri,
    } = this.providerConfig('google');


    const body =
      new URLSearchParams({

        client_id:clientId,

        client_secret:clientSecret,

        code,

        redirect_uri:redirectUri,

        grant_type:
        'authorization_code',

      });



    const token =
      await firstValueFrom(

        this.http.post<{
          access_token:string
        }>(

        'https://oauth2.googleapis.com/token',

        body.toString(),

        {
          headers:{
          'Content-Type':
          'application/x-www-form-urlencoded'
          }
        }

        )

      );


    const profile =
      await firstValueFrom(

        this.http.get<{
          sub:string;
          email:string;
          name:string;

        }>(

        'https://www.googleapis.com/oauth2/v3/userinfo',

        {
          headers:{
            Authorization:
            `Bearer ${token.data.access_token}`,
          },
        }

        )

      );


    return {

      providerId:
      profile.data.sub,

      email:
      profile.data.email,

      name:
      profile.data.name,

    };

  }



  private async githubProfile(
    code:string,
  ):Promise<OAuthProfile>{

    const {
      clientId,
      clientSecret,
      redirectUri,
    } =
    this.providerConfig('github');



    const token =
      await firstValueFrom(

        this.http.post<{
          access_token:string
        }>(

        'https://github.com/login/oauth/access_token',

        {
          client_id:clientId,
          client_secret:clientSecret,
          code,
          redirect_uri:redirectUri,
        },

        {
          headers:{
            Accept:'application/json'
          }
        }

        )

      );



    if(!token.data.access_token){

      throw new BadRequestException(
        'Github token missing'
      );

    }



    const profile =
      await firstValueFrom(

        this.http.get<{
          id:number;
          login:string;
          name?:string;
          email?:string;

        }>(

        'https://api.github.com/user',

        {
          headers:{
            Authorization:
            `Bearer ${token.data.access_token}`,

            'User-Agent':
            'AI-Agent'
          },
        }

        )

      );


    return {

      providerId:
      String(profile.data.id),

      email:
      profile.data.email ?? '',

      name:
      profile.data.name ??
      profile.data.login,

    };

  }

}