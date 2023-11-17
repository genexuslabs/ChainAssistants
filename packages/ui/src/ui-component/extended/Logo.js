import logo from 'assets/images/SAIA_logo.png'
import logoDark from 'assets/images/SAIA_logo_dark.png'

import { useSelector } from 'react-redux'

// ==============================|| LOGO ||============================== //

const Logo = () => {
    const customization = useSelector((state) => state.customization)

    return (
        <div style={{ alignItems: 'center', display: 'flex', flexDirection: 'row' }}>
            <img
                style={{ objectFit: 'contain', height: '60px', width: '60px' }}
                src={customization.isDarkMode ? logoDark : logo}
                alt='SAIA'
            />
        </div>
    )
}

export default Logo
