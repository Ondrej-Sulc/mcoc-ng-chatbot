import React from 'react';
import { Starfield } from './Starfield';

const PageBackground = React.memo(function PageBackground() {
  return (
    <div className="absolute top-0 left-0 w-full h-full hero-bg z-[-1]">
      <Starfield />
    </div>
  );
});

export default PageBackground;
